import * as url from 'url';
import type { UrlWithParsedQuery } from 'url';
import * as fs from 'fs';
import * as http from 'http';
import type { IncomingMessage } from 'http';
import * as puppeteer from 'puppeteer';
import type { Browser, Page, ElementHandle } from 'puppeteer';
import { LOGIN_PAGE, DATA_PAGE, USERNAME, PASSWORD } from './constant';

let browser: Browser;
let page: Page;

let total = 0;
let success = 0;
let failed = 0;
const failedFiles: string[] = [];

const sleep = (time: number) => new Promise((resolve) => {
  setTimeout(resolve, time);
});

const init = async () => {
  browser = await puppeteer.launch();
  page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
};

const login = async (username: string, password: string) => {
  await page.goto(LOGIN_PAGE);
  await page.locator('.login_1').fill(username);
  await page.locator('.login_password').fill(password);
  await page.locator('.from_yellow_btn').click();
  console.log('LOGIN SUCCESSFUL');
};

const getPaginatedData = async () => {
  const downloadBtns: ElementHandle[] = await page.$$('.download');
  const promises: PromiseSettledResult<void>[] = await Promise.allSettled(downloadBtns.map(async (btn) => {
    let href = await btn.getProperty('href');
    let address = await href.jsonValue() as string;
    return downloadFitFile(address);
  }));
  let paginatedTotal = downloadBtns.length;
  let paginatedSuccessful = promises.reduce((sum, promise) => {
    if (promise.status === 'fulfilled') sum += 1;
    return sum;
  }, 0);
  let paginatedFailed = paginatedTotal - paginatedSuccessful;

  total += paginatedTotal;
  success += paginatedSuccessful;
  failed += paginatedFailed;

  console.log(`[PAGE] TOTAL: ${paginatedTotal}, SUCCESSFUL: ${paginatedSuccessful}, FAILED: ${paginatedFailed}`);
  await nextPage();
};

const downloadFitFile = async (address: string) => {
  const q: UrlWithParsedQuery = url.parse(address, true);
  const path: string = `./files/${q.pathname}`;
  const filename = q.pathname!.slice(1);
  return new Promise<void>((resolve, reject) => {
    http.get(address, (res: IncomingMessage) => {
      const { statusCode } = res;
      if (statusCode !== 200) {
        console.log(`DOWNLOAD FAILED: ${filename}`);
        failedFiles.push(filename);
        reject();
      }
      const file = fs.createWriteStream(path);
      res.pipe(file);
    });
    console.log(`DOWNLOAD SUCCESSFUL: ${filename}`);
    resolve();
  });
};

const nextPage = async () => {
  const nextPageBtn: ElementHandle | null = await page.$('.nextPage');
  if (!nextPageBtn) {
    console.log('THE LAST PAGE');
    console.log(`[TOTAL]: ${total}, [SUCCESSFUL]: ${success}, [FAILED]: ${failed}`);
    if (failedFiles.length) {
      console.log('FAILED FILES:');
      console.log(failedFiles);
    }
    await browser.close();
    console.log('DONE!');
  } else {
    console.log('GO TO NEXT PAGE');
    await nextPageBtn.click();
    await sleep(1000);
    await getPaginatedData();
  }
};

const getMageneData = async () => {
  if (!USERNAME || !PASSWORD) {
    console.log('USERNAME & PASSWORD REQUIRED!');
    return;
  }
  await init();
  await login(USERNAME, PASSWORD);
  await sleep(1000);
  await page.goto(DATA_PAGE);
  await sleep(1000);
  await getPaginatedData();
};

try {
  getMageneData();
} catch (err) {
  console.log(err);
}
