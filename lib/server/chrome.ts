import puppeteer from "puppeteer";
import { launch } from "chrome-launcher";

const DEFAULT_FLAGS = [
  "--headless=new",
  "--disable-dev-shm-usage",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-sync",
  "--mute-audio",
  "--no-first-run",
  "--no-default-browser-check",
  "--no-sandbox",
  "--disable-setuid-sandbox"
];

export async function launchPuppeteerBrowser() {
  return puppeteer.launch({
    headless: true,
    args: DEFAULT_FLAGS,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    defaultViewport: {
      width: 1440,
      height: 960,
      deviceScaleFactor: 1
    }
  });
}

export async function launchLighthouseChrome() {
  return launch({
    chromePath: process.env.LIGHTHOUSE_CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    chromeFlags: DEFAULT_FLAGS,
    logLevel: "error"
  });
}
