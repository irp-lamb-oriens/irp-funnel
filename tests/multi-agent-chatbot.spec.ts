import { test, expect } from '@playwright/test';

test.describe('HeroForm Multi-Agent Chatbot Tests', () => {
  test('should enforce 48-hour scheduling rule and show channel options', async ({ page }) => {
    test.setTimeout(90000);

    // 1. Navigate
    await page.goto('http://localhost:5173'); 
    await page.waitForSelector('#hero-form');

    // 2. Click Chat
    await page.locator('button.skip-btn', { hasText: 'Chat with Virtual Assistant' }).click();

    // 3. Verify Intro & Channel Btns
    await expect(page.locator('.chatbot-header h3')).toContainText('Lili');
    await expect(page.locator('.channel-btn.whatsapp')).toBeVisible();
    await expect(page.locator('.channel-btn.messenger')).toBeVisible();

    // 4. Try to book a call for tomorrow (violates 48h rule)
    const input = page.locator('.chat-input-area input[type="text"]');
    await input.fill('My name is Test User, my email is test@example.com, and I want to move from Canada to Spain. Can I book a call for tomorrow at 10am?');
    await page.locator('.chat-input-area button.send-btn').click();

    // 5. Wait for Lili to refuse and explain the 48h rule
    const replyLocator = page.locator('.message.assistant .bubble').nth(1);
    await page.waitForFunction((locator) => {
        const el = document.querySelectorAll('.message.assistant .bubble')[1];
        return el && el.textContent.trim().length > 0;
    }, { timeout: 20000 });
    const reply = await replyLocator.innerText();
    
    console.log("Lili's refusal reply:", reply);
    // She should mention 48 hours or something about experts needing time
    expect(reply.toLowerCase()).toMatch(/48|hour|analyze|prepare/);
  });
});
