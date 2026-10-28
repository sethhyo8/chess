import {test, expect} from '@playwright/test';
test('Coach panel stays fixed through hints and final hint draws the move arrow', async ({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Play With Coach',exact:true}).click();
 await expect(page.locator('.topbar')).toBeHidden();
 await expect(page.getByRole('button',{name:'Why?',exact:true})).toHaveCount(0);
 const panel=page.locator('.coach-fixed-panel');
 const before=await panel.boundingBox();
 for(let i=0;i<3;i++) await page.getByRole('button',{name:'Hint',exact:true}).click();
 await expect(page.locator('.arrow-layer')).toBeVisible();
 await page.getByRole('button',{name:'What is the threat?',exact:true}).click();
 const after=await panel.boundingBox();
 expect(after.width).toBe(before.width); expect(after.height).toBe(before.height);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
