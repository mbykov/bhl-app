//

import fse from 'fs-extra'

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

const log = console.log

console.log('_PAGE.JS')

// читает примеры, временно

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
  let expath = '../lib/examples.js'
  expath = resolve(__dirname, expath)
  // let records = fse.readJsonSync(expath)
  let records = fse.readFileSync(expath, 'utf-8')
  log('_records ok', records)

  return {
    records
  };
}
