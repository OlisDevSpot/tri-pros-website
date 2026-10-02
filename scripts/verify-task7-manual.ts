import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const LOCALHOST = 'http://localhost:3000'
const SECRET = process.env.DEV_LOGIN_SECRET
if (!SECRET)
  throw new Error('DEV_LOGIN_SECRET not set')

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

const screenshotDir = '/tmp/screenshots-task7'
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true })
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    console.log('🔐 Signing in...')
    const signInUrl = `${LOCALHOST}/api/dev/playwright-session?secret=${SECRET}&redirect=/dashboard`
    await page.goto(signInUrl, { waitUntil: 'networkidle' })
    await sleep(500)

    console.log('✅ Signed in on dashboard')

    // Click Meetings in sidebar
    console.log('\n📌 Clicking Meetings in sidebar...')
    const meetingsSidebarLink = page.locator('a[href="/records/meetings"]')
    await meetingsSidebarLink.click()

    // Screenshot at 50ms
    await sleep(50)
    const shot50ms = path.join(screenshotDir, '01-50ms.png')
    await page.screenshot({ path: shot50ms })
    console.log(`📸 50ms: ${shot50ms}`)

    // Screenshot at 300ms
    await sleep(250)
    const shot300ms = path.join(screenshotDir, '02-300ms.png')
    await page.screenshot({ path: shot300ms })
    console.log(`📸 300ms: ${shot300ms}`)

    // Wait and final screenshot
    await sleep(500)
    const shotFinal = path.join(screenshotDir, '03-final.png')
    await page.screenshot({ path: shotFinal })
    console.log(`📸 Final: ${shotFinal}`)

    console.log('\n⏰ Testing DateTimePicker...')
    await page.waitForLoadState('networkidle')

    const datePickerButtons = page.locator('button:has-text("Pick date & time")')
    const count = await datePickerButtons.count()
    console.log(`Found ${count} date picker buttons`)

    if (count > 0) {
      console.log('Opening first date picker...')
      await datePickerButtons.first().click()
      await sleep(300)

      const pickerShot = path.join(screenshotDir, '04-picker-open.png')
      await page.screenshot({ path: pickerShot })
      console.log(`📸 Picker: ${pickerShot}`)

      const timeInput = page.locator('input[type="time"]')
      if (await timeInput.isVisible()) {
        const timeValue = await timeInput.inputValue()
        console.log(`   Time value: "${timeValue}"`)
        console.log(`   ✅ Picker opened with current value`)
      }

      console.log('Pressing Escape...')
      await page.keyboard.press('Escape')
      await sleep(300)
    }

    console.log('\n✅ Manual checks complete!')
    console.log(`Screenshots: ${screenshotDir}`)
  }
  catch (err: any) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
  finally {
    await browser.close()
  }
}

run()
