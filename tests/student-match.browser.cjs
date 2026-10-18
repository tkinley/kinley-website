// Optional integration checks. Uses fictional files only and a local server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const { pdf, docx } = require('./student-match-fixtures.cjs');
const root=path.resolve(__dirname,'..'), out=path.join(root,'test-results');
const origin='http://127.0.0.1:4187';
fs.mkdirSync(out,{recursive:true});
const results=[];
const pass = name => { results.push(name); console.log(`PASS ${name}`); };
const fictional='MATCHER_PRIVATE_SENTINEL_789. Fictional Person PhD candidate in Biology. Research Python Genomics conference poster. International student. fake@example.test. <img src="https://example.test/private" onerror="alert(1)">';
const docxMime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
(async()=> {
  const server=spawn(process.execPath,['scripts/serve-student-match.mjs'],{cwd:root,env:{...process.env,PORT:'4187',MATCHER_BASE_PATH:'/kinley-website'},stdio:['ignore','pipe','pipe']});
  let browser;
  try {
    await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error(`Preview server exited ${code}`)));});
    const executablePath=process.env.MATCHER_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
    browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    context.setDefaultTimeout(10000);
    const page=await context.newPage();
    const requests=[],errors=[];
    page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${origin}/student-match.html`);
    await page.waitForSelector('.resource-card');
    assert.match(await page.locator('#result-count').innerText(),/24 of 108/);
    assert.equal(await page.locator('#verify-count').innerText(),'108');
    await page.screenshot({path:path.join(out,'matcher-desktop.png')});
    pass('initial directory: 108 resources, unknown eligibility preserved, no login');

    const profiles=[
      ['Undergraduate','domestic',['Food','Scholarships']],
      ['Undergraduate','international',['Free Software','Learning']],
      ['PhD','domestic',['Research','Travel']],
      ["Master's",'international',['Research','Financial Support']],
    ];
    for(const [level,status,interests] of profiles) {
      await page.locator('#reset-all').click();
      await page.locator('#academic-level').selectOption(level);
      await page.locator('#student-status').selectOption(status);
      await page.locator('#enrolled').selectOption('yes');
      await page.locator('#major').fill('Biology');
      for(const interest of interests) await page.getByRole('checkbox',{name:interest,exact:true}).check();
      await page.locator('#match-button').click();
      assert.ok(await page.locator('.resource-card').count());
      assert.equal(await page.locator('#view-recommended').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('.availability.past').count(),0);
      assert.equal(await page.locator('.eligibility-badge.ineligible').count(),0);
      pass(`fictional ${status} ${level}: relevant results, no conflicting or past entries recommended`);
    }
    await page.locator('#view-all').click();
    for(const category of ['scholarships','research','ai-software','travel','campus-benefits','financial-support']) {
      await page.locator(`[data-category="${category}"]`).click();
      assert.ok(await page.locator('.resource-card').count());
    }
    await page.locator('[data-category="all"]').click();
    await page.locator('#resource-search').fill('cupboard');
    assert.equal(await page.locator('.resource-card h3').innerText(),"Cats' Cupboard");
    await page.locator('#resource-search').fill('no-such-fictional-resource');
    assert.equal(await page.locator('#empty-state').isVisible(),true);
    await page.locator('#clear-filters').click();
    await page.locator('#sort-order').selectOption('title');
    assert.equal(await page.locator('.resource-card h3').first().innerText(),'7 Cups');
    await page.locator('#sort-order').selectOption('deadline');
    assert.equal(await page.locator('.resource-card h3').first().innerText(),'7 Cups');
    await page.locator('#show-more').click(); assert.equal(await page.locator('.resource-card').count(),48);
    await page.locator('#eligibility-filter').selectOption('ineligible');
    assert.ok(await page.locator('.eligibility-badge.ineligible').count());
    await page.locator('#reset-all').click();
    pass('all six category filters, search, empty state, sorting, pagination, and eligibility filter');
    await page.locator('#academic-level').selectOption('Undergraduate');
    await page.locator('#match-button').click();
    assert.equal(await page.locator('#view-all').getAttribute('aria-pressed'),'true');
    assert.match(await page.locator('#results-description').innerText(),/No specific relevance matches/);
    await page.locator('#reset-all').click();
    pass('a minimal profile with no relevance signals still opens the full directory');

    // Full browser parsing through the actual vendored libraries.
    async function upload(name,buffer,mimeType='application/pdf') {
      await page.locator('#document-input').setInputFiles({name,mimeType,buffer});
      await page.waitForFunction(()=>document.getElementById('drop-zone').getAttribute('aria-busy')==='false');
    }
    for(const [name,data,mime] of [['fictional.pdf',pdf(fictional),'application/pdf'],['fictional.docx',docx(fictional),docxMime]]) {
      await upload(name,data,mime);
      assert.match(await page.locator('#document-status').innerText(),/Read locally/);
      assert.equal(await page.locator('#student-status').inputValue(),'');
      assert.equal(await page.locator('#enrolled').inputValue(),'');
      assert.equal(await page.locator('#academic-level').inputValue(),'');
      await page.locator('#use-suggestions').click();
      assert.equal(await page.locator('#academic-level').inputValue(),'PhD');
      assert.equal(await page.locator('#major').inputValue(),'Biology');
      assert.match(await page.locator('#skills').inputValue(),/Python/);
      assert.doesNotMatch(await page.locator('body').innerText(),/MATCHER_PRIVATE_SENTINEL|fake@example/);
      await page.locator('#major').fill('Manually edited major');
      await page.locator('#remove-document').click();
      assert.equal(await page.locator('#major').inputValue(),'Manually edited major');
      assert.equal(await page.locator('#academic-level').inputValue(),'');
      assert.equal(await page.locator('#skills').inputValue(),'');
      await page.locator('#reset-all').click();
      pass(`${name}: parsed locally, reviewed suggestions, no status inference, safe rendering, removal preserves edits`);
    }
    await upload('scan.pdf',pdf(''));
    assert.match(await page.locator('#document-status').innerText(),/Scanned or image-only/);
    await upload('too-many-pages.pdf',pdf('Fictional research resume',31));
    assert.match(await page.locator('#document-status').innerText(),/processing limits/);
    await upload('wrong.pdf',Buffer.from('not a PDF'));
    assert.match(await page.locator('#document-status').innerText(),/could not be read/);
    await upload('broken.pdf',Buffer.from('%PDF-1.4 broken fictional file'));
    assert.match(await page.locator('#document-status').innerText(),/could not be read/);
    await upload('broken.docx',Buffer.from('PK broken fictional file'),docxMime);
    assert.match(await page.locator('#document-status').innerText(),/could not be read/);
    await upload('wrong.txt',Buffer.from('Fictional text'),'text/plain');
    assert.match(await page.locator('#document-status').innerText(),/PDF or DOCX/);
    await upload('empty.pdf',Buffer.alloc(0));
    assert.match(await page.locator('#document-status').innerText(),/non-empty/);
    await upload('large.pdf',Buffer.alloc(8*1024*1024+1));
    assert.match(await page.locator('#document-status').innerText(),/up to 8 MB/);
    await page.locator('#skip-upload').click(); assert.equal(await page.locator('#profile-title').evaluate(e=>e===document.activeElement),true);
    pass('scanned PDF, long PDF, wrong signature, damaged PDF/DOCX, unsupported/empty/oversized files, and manual fallback');

    // Real drag-and-drop event with a fictional File, never a document upload.
    const transfer=await page.evaluateHandle(buffer=>{const t=new DataTransfer();t.items.add(new File([new Uint8Array(buffer)],'drop.docx',{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));return t;},[...docx(fictional)]);
    await page.locator('#drop-zone').dispatchEvent('drop',{dataTransfer:transfer});
    await page.waitForFunction(()=>document.getElementById('document-status').textContent.startsWith('Read locally'));
    await page.locator('#reset-all').click();
    assert.equal(await page.locator('#document-input').inputValue(),''); assert.equal(await page.locator('#suggestions').isVisible(),false);
    assert.equal(await page.locator('#major').inputValue(),'');
    await page.reload(); await page.waitForSelector('.resource-card');
    assert.equal(await page.locator('#major').inputValue(),'');
    assert.deepEqual(await page.evaluate(async()=>({local:localStorage.length,session:sessionStorage.length,databases:(await indexedDB.databases()).length})),{local:0,session:0,databases:0});
    assert.ok(requests.every(r=>r.url.startsWith(origin+'/') && r.method==='GET' && !r.body));
    assert.ok(requests.every(r=>!r.url.includes('MATCHER_PRIVATE_SENTINEL')));
    assert.deepEqual(errors,[]);
    pass('drag-and-drop, reset/reload, no storage, no POSTs, no third-party requests, and no page errors');

    for(const [width,height] of [[1440,1000],[768,1024],[375,812],[320,720]]) {
      await page.setViewportSize({width,height});
      await page.evaluate(()=>window.scrollTo(0,0));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}px`);
      const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      fs.writeFileSync(path.join(out,`accessibility-${width}.json`),JSON.stringify(audit.violations,null,2));
      assert.deepEqual(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],`accessibility at ${width}px`);
      await page.screenshot({path:path.join(out,`matcher-${width}.png`)});
      if(width===375) {
        await page.locator('#results').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(out,'matcher-mobile-results.png')});
      }
      pass(`${width}px layout: no horizontal overflow and no automated WCAG A/AA violations`);
    }
    await page.setViewportSize({width:1440,height:1000});await page.reload();await page.waitForSelector('.resource-card');
    await page.keyboard.press('Tab'); assert.equal(await page.locator('.skip-link').evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Enter');
    await page.locator('#browse-files').focus();
    const chooser=page.waitForEvent('filechooser'); await page.keyboard.press('Enter'); const dialog=await chooser; await dialog.setFiles([]);
    await page.locator('#interests input').first().focus(); await page.keyboard.press('Space'); assert.equal(await page.locator('#interests input').first().isChecked(),true);
    pass('keyboard skip link, file chooser, and interest checkboxes');

    // A failed data request leaves a readable fallback and the directory link.
    const fallback=await context.newPage();await fallback.route('**/data/student-opportunities.json',r=>r.abort());await fallback.goto(`${origin}/student-match.html`);await fallback.locator('#data-error').waitFor({state:'visible'});
    assert.equal(await fallback.locator('#match-button').isDisabled(),true);
    assert.ok(await fallback.locator('a[href="student-benefits.html"]').count());
    await fallback.close(); pass('data-load failure has an accessible manual explanation and directory fallback');

    const timed=await context.newPage();
    await timed.clock.install();
    await timed.route('**/student-document-worker.js',r=>r.fulfill({contentType:'text/javascript',body:'self.onmessage = () => {};'}));
    await timed.goto(`${origin}/student-match.html`);
    const started=timed.waitForEvent('worker');
    await timed.locator('#document-input').setInputFiles({name:'timeout.pdf',mimeType:'application/pdf',buffer:pdf(fictional)});
    await started; await timed.clock.fastForward(26000);
    await timed.waitForFunction(()=>document.getElementById('document-status').textContent.includes('timed out'));
    assert.equal(await timed.locator('#drop-zone').getAttribute('aria-busy'),'false');
    await timed.close(); pass('a stalled parser is terminated with a manual-entry fallback');

    // Exercise repository-prefixed paths without modifying any production URLs.
    const prefixed=await context.newPage();
    await prefixed.goto(`${origin}/kinley-website/student-match.html`);
    await prefixed.waitForSelector('.resource-card');
    assert.match(await prefixed.locator('#result-count').innerText(),/24 of 108/);
    await prefixed.locator('#document-input').setInputFiles({name:'prefixed.pdf',mimeType:'application/pdf',buffer:pdf(fictional)});
    await prefixed.waitForFunction(()=>document.getElementById('document-status').textContent.startsWith('Read locally'));
    await prefixed.close(); pass('GitHub Pages repository subpath supports JSON, modules, fonts, and PDF workers');

    const nojs=await browser.newContext({javaScriptEnabled:false});const basic=await nojs.newPage();
    await basic.goto(`${origin}/student-match.html`);
    assert.equal(await basic.locator('noscript a[href="student-benefits.html"]').isVisible(),true);
    await nojs.close(); pass('JavaScript-disabled visitors retain a visible original-directory fallback');
    const local=await context.newPage();await local.goto(pathToFileURL(path.join(root,'student-match.html')).href);
    await local.locator('#local-preview-help').waitFor({state:'visible'});
    assert.equal(await local.locator('#browse-files').isDisabled(),true);
    await local.close();pass('direct-file opening provides HTTP preview instructions and a directory fallback');
    fs.writeFileSync(path.join(out,'student-match-report.json'),JSON.stringify({browser:browser.version(),passed:results,requests:requests.length,externalRequests:requests.filter(r=>!r.url.startsWith(origin+'/')).length},null,2));
    console.log(`Completed ${results.length} browser check groups.`);
  } finally { if(browser) await browser.close(); server.kill(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
