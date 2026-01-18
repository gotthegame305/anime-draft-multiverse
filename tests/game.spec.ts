import { test, expect } from '@playwright/test';

test('Anime Draft Game Flow', async ({ page }) => {
    // 1. Navigate to Game Page
    await page.goto('/game');
    await expect(page.getByText('Multiverse Draft')).toBeVisible();

    // 2. Select a universe (assuming at least one exists, if not, we try to proceed or skip check logic)
    // If seeded, we should see checkboxes.
    const universeCheckboxes = await page.locator('input[type="checkbox"]');
    const count = await universeCheckboxes.count();

    if (count > 0) {
        console.log(`Found ${count} universes. Selecting first one if not selected.`);
        // Just ensure we have at least one selected (default is typically all selected in our code)
        // Check if start button is enabled
        const startBtn = page.getByRole('button', { name: 'Start Draft' });
        await expect(startBtn).toBeEnabled();
        await startBtn.click();
    } else {
        console.log('No universes found. Make sure characters are seeded.');
        // Proceeding might fail if the button is disabled, but let's see.
        await page.getByRole('button', { name: 'Start Draft' }).click();
    }

    // 3. Draft Phase
    await expect(page.getByText('Anime Draft')).toBeVisible({ timeout: 10000 });

    // Draw and Place 5 Cards
    for (let i = 0; i < 5; i++) {
        // Click Draw
        await page.getByRole('button', { name: 'DRAW' }).click();

        // Wait for card to appear in hand (check for card art or name present)
        // The hand container has an image.
        // The hand container has an image.
        const handImage = page.locator('div.h-64 img'); // Updated selector for new layout

        // Test Skip on the first card only to verify logic
        if (i === 0) {
            const skipBtn = page.getByRole('button', { name: 'SKIP' });
            if (await skipBtn.isVisible()) {
                console.log('Testing Skip...');
                await skipBtn.click();
                // Expect hand to empty
                await expect(page.getByRole('button', { name: 'DRAW' })).toBeVisible();
                // Re-draw
                await page.getByRole('button', { name: 'DRAW' }).click();
                await expect(handImage).toBeVisible();
            }
        }

        // Place in the i-th slot
        // We need to find the empty slots. They are buttons.
        // We can use the Role Label we added: "Captain", "Vice Captain", etc.
        const roles = ['Captain', 'Vice Captain', 'Tank', 'Duelist', 'Support'];
        // Use exact text match for the role label span specifically, then find the parent button
        const slot = page.locator('button').filter({ has: page.getByText(roles[i], { exact: true }) });
        await slot.click();

        // For the last slot (index 4), the game immediately transitions to RESULT
        // So we do not expect to see the image in the slot.
        if (i < 4) {
            // Verify slot is filled (should contain an image now)
            // The slot button itself will have the image inside
            await expect(slot.locator('img')).toBeVisible();
        }
    }

    // 4. Result Phase
    await expect(page.getByText('Community Vote')).toBeVisible({ timeout: 10000 });

    // Check that Opponent Team is generated
    await expect(page.getByText('Opponent Team')).toBeVisible();

    // Click Result
    await page.getByRole('button', { name: 'I Won' }).click();

    // Expect Victory Message
    await expect(page.getByText('Victory Recorded!')).toBeVisible();
});
