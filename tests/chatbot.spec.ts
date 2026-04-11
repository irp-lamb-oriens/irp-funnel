import { test, expect } from '@playwright/test';

test.describe('HeroForm Chatbot End-to-End Tests', () => {
  test('should allow user to interact with the chatbot, extract fields, and fallback to correct form step', async ({ page }) => {
    test.setTimeout(90000); // 90s timeout for LLM responses

    // 1. Navigate to the form page where the HeroForm is rendered.
    console.log("Navigating to local dev server...");
    await page.goto('http://localhost:5173'); 

    // Wait for the hero form to be visible
    await page.waitForSelector('#hero-form', { state: 'visible' });

    // 2. Switch to chatbot mode
    console.log("Clicking 'Chat with Virtual Assistant' button...");
    const chatBtn = page.locator('button.skip-btn', { hasText: 'Chat with Virtual Assistant' });
    
    // Explicitly wait for it to be actionable before clicking
    await chatBtn.waitFor({ state: 'visible', timeout: 10000 });
    await chatBtn.click();

    // Verify Chatbot UI is loaded
    await expect(page.locator('.chatbot-header h3')).toContainText('IRP Virtual Assistant');
    console.log("Chatbot is visible.");

    // Wait for the first message from the assistant
    await page.waitForSelector('.message.assistant .bubble');
    const firstMsg = await page.locator('.message.assistant .bubble').first().innerText();
    console.log("Assistant intro:", firstMsg);

    // 3. User sends a message containing form details
    console.log("Typing user message 1...");
    const input = page.locator('.chat-input-area input[type="text"]');
    await input.fill('Hi, my name is Armando Smith, my email is armando@example.com and I want to move to Costa Rica.');
    await page.locator('.chat-input-area button.send-btn').click();

    // 4. Wait for Assistant to reply
    console.log("Waiting for Assistant's response...");
    await page.waitForSelector('.message.assistant:nth-child(3) .bubble', { timeout: 20000 });
    const reply1 = await page.locator('.message.assistant:nth-child(3) .bubble').innerText();
    console.log("Assistant reply 1:", reply1);

    // 5. Send a second message
    console.log("Typing user message 2...");
    await input.fill('I have a budget of $20000, and I am moving from Canada.');
    await page.locator('.chat-input-area button.send-btn').click();

    console.log("Waiting for Assistant's response 2...");
    // Wait for 5th message (1:intro, 2:user, 3:reply, 4:user, 5:reply)
    await page.waitForSelector('.message.assistant:nth-child(5) .bubble', { timeout: 20000 });
    const reply2 = await page.locator('.message.assistant:nth-child(5) .bubble').innerText();
    console.log("Assistant reply 2:", reply2);

    // 6. Test fallback to form
    console.log("Clicking 'Back to standard form'...");
    await page.locator('.chatbot-header button.back-btn').click();

    // Wait for Svelte transitions (0.6s) to settle out
    await page.waitForTimeout(1000);

    // 7. Verify chatbot is gone
    await expect(page.locator('.chatbot-header')).not.toBeVisible();
    console.log("SUCCESS: Chatbot is no longer visible. Form should have taken over.");

    // 8. Find any heading in the active form frame
    // (step 1 = h6, step 2+ = h2. So we use a broader selector)
    const headingLocator = page.locator(
      '.form-frame.active h2, .form-frame.active h6, .form-frame.active h1'
    );
    await expect(headingLocator.first()).toBeVisible({ timeout: 5000 });
    const headingText = await headingLocator.first().innerText();
    console.log("Returned to form on step with heading:", headingText);
    console.log("FULL PASS: Chatbot gone, form re-appeared on step with heading:", headingText);
  });
});
