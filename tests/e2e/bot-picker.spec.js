import {test, expect} from '@playwright/test';
test('site chrome and compact bot selection work across screen sizes', async ({page})=>{
 await page.goto('/');
 await expect(page).toHaveTitle('ChessGrove — Free Chess Reviews & Coaching');
 await expect(page.locator('.topbar')).toHaveCount(0);
 const favicon=await page.locator('link[rel="icon"]').getAttribute('href');
 expect((await page.request.get(favicon)).ok()).toBe(true);
 await page.getByRole('button',{name:'Play with Bots',exact:true}).click();
 for (const select of await page.locator('.play-setup select').all()) {
   const style=await select.evaluate(el=>({padding:getComputedStyle(el).paddingRight,size:getComputedStyle(el).backgroundSize,position:getComputedStyle(el).backgroundPosition,image:getComputedStyle(el).backgroundImage}));
   expect(style.padding).toBe('44px');expect(style.size).toBe('16px 16px');expect(style.image).toContain('svg');
 }
 const cards=page.locator('.bot-card');await expect(cards).toHaveCount(7);
 const boxes=await cards.evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,height:e.getBoundingClientRect().height})));
 expect(new Set(boxes.map(b=>b.x)).size).toBe(1);expect(new Set(boxes.map(b=>b.height)).size).toBe(1);
 await cards.filter({hasText:'Jasper'}).click();
 await expect(page.locator('.selected-opponent')).toContainText('Jasper');
 await page.getByLabel('Your pieces',{exact:true}).selectOption('b');
 await page.getByLabel('Time control',{exact:true}).selectOption('5');
 await page.screenshot({path:'work/bot-picker-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'work/bot-picker-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Play Jasper',exact:true}).click();
 await expect(page.locator('.player-line').first()).toContainText('Jasper');
 const session=await page.evaluate(()=>JSON.parse(localStorage.getItem('grove-bot')));
 expect(session.color).toBe('b');expect(session.preset).toBe(5);
});
