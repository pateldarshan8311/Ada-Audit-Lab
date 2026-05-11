import puppeteer from "puppeteer";

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

const LIGHTHOUSE_DEBUGGING_FLAG = "--remote-debugging-port=0";

function getExecutablePath() {
  return (
    process.env.LIGHTHOUSE_CHROME_PATH ||
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    puppeteer.executablePath() ||
    undefined
  );
}

function createLaunchOptions(extraArgs: string[] = []) {
  return {
    headless: true,
    args: [...DEFAULT_FLAGS, ...extraArgs],
    executablePath: getExecutablePath(),
    defaultViewport: {
      width: 1440,
      height: 960,
      deviceScaleFactor: 1
    }
  };
}

export async function launchPuppeteerBrowser() {
  return puppeteer.launch(createLaunchOptions());
}

export async function launchLighthouseChrome() {
  const browser = await puppeteer.launch(createLaunchOptions([LIGHTHOUSE_DEBUGGING_FLAG]));
  const endpoint = new URL(browser.wsEndpoint());
  const port = Number(endpoint.port);

  if (!Number.isFinite(port)) {
    await browser.close();
    throw new Error("Could not determine the Lighthouse debugging port.");
  }

  return {
    port,
    kill: async () => {
      await browser.close();
    }
  };
}
