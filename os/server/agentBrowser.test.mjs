import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentBrowser, profileFromCommandLine, safeUrl, visibleTabs} from './agentBrowser.mjs';

const ID = 'A1B2C3D4E5F60718293A4B5C6D7E8F90';

test('tab links lose their query and fragment', () => {
  assert.deepEqual(safeUrl('https://www.facebook.com/adsmanager/manage?act=1&access_token=SECRET#x'), {url: 'https://www.facebook.com/adsmanager/manage', host: 'facebook.com'});
  assert.deepEqual(safeUrl('not a link'), {url: '', host: ''});
});

test('only real pages are shown', () => {
  const tabs = visibleTabs([
    {id: ID, type: 'page', title: 'Ads Manager', url: 'https://adsmanager.facebook.com/x?token=abc'},
    {id: 'B'.repeat(32), type: 'page', title: 'DevTools', url: 'devtools://devtools/bundled'},
    {id: 'C'.repeat(32), type: 'service_worker', url: 'https://x.com'},
    {id: 'D'.repeat(32), type: 'page', title: 'New Tab', url: 'chrome://newtab/'},
    {id: '../etc', type: 'page', url: 'https://x.com'},
  ]);
  assert.deepEqual(tabs.map(tab => tab.title), ['Ads Manager', 'New tab']);
  assert.equal(visibleTabs([{id: ID, type: 'page', title: 'Tools &amp; Insights', url: 'https://kalodata.com'}])[0].title, 'Tools & Insights');
  assert.equal(tabs[0].url, 'https://adsmanager.facebook.com/x');
  assert.equal(tabs[1].blank, true);
});

test('the profile is read from Chrome’s command line', () => {
  assert.equal(profileFromCommandLine(['chrome.exe', '--remote-debugging-port=9222', '--user-data-dir=C:\\Users\\me\\AppData\\Local\\Launchroom\\agent-browser']), 'C:\\Users\\me\\AppData\\Local\\Launchroom\\agent-browser');
  assert.equal(profileFromCommandLine(['chrome.exe']), '');
});

test('status says off when nothing answers on the port', async () => {
  const browser = createAgentBrowser({fetchImpl: async () => {throw new Error('refused');}, profileDir: 'C:\\tmp\\agent'});
  const status = await browser.status();
  assert.equal(status.running, false);
  assert.deepEqual(status.tabs, []);
});

test('start refuses when Chrome is missing, and open refuses non-web links', async () => {
  const browser = createAgentBrowser({fetchImpl: async () => {throw new Error('refused');}, chromePaths: ['Z:\\nowhere\\chrome.exe'], profileDir: 'C:\\tmp\\agent'});
  await assert.rejects(browser.start(), /Chrome was not found/);
  await assert.rejects(browser.open('file:///C:/secret.txt'), /https/);
  await assert.rejects(browser.open('javascript:alert(1)'), /https/);
});

test('a tab id must look like Chrome’s', async () => {
  const browser = createAgentBrowser({fetchImpl: async () => ({ok: true, json: async () => []})});
  await assert.rejects(browser.picture('../../json/close'), /Unknown tab/);
  await assert.rejects(browser.focus(ID), /closed/);
});
