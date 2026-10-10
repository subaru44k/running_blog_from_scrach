# Optional browser smoke test; requires an installed Python Playwright and Chromium.
# Serve a production build with PUBLIC_DRAW_API_BASE configured, then run:
# python astro-blog/scripts/draw-flow-smoke.py http://127.0.0.1:4321
# All draw API/upload requests are mocked; external requests are blocked.
import asyncio, os, sys
from playwright.async_api import async_playwright
BASE=(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4321').rstrip('/')
IMAGE='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='
PROMPT={'promptId':'prompt-2026-10','promptText':'30秒でフクロウを描いて','dateJst':'2026-10-10','rankingEligible':True}
RESULT={'submissionId':'test-flow','score':70,'breakdown':{'likeness':45,'composition':45,'originality':0},'oneLiner':'講評です。','tips':['形','線'],'rankingEligible':True,'isRanked':True,'rank':1,'reviewStatus':'done'}
PENDING={'promptId':PROMPT['promptId'],'promptText':PROMPT['promptText'],'submissionId':'test-flow','imageKey':'draw/prompt-2026-10/test-flow.png','nickname':'flow-test'}
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  context=await browser.new_context()
  page=await context.new_page()
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  calls=[]; started=asyncio.Event(); release=asyncio.Event(); mode={'value':'success'}
  async def api(route):
   path=route.request.url.split('?')[0]
   if path.endswith('/prompt'): data=PROMPT
   elif path.endswith('/submit'):
    payload=route.request.post_data_json;calls.append(('submit',payload));started.set()
    await release.wait()
    if mode['value']=='failure':await route.fulfill(status=503,json={'error':'採点できませんでした。少し待って再試行してください。'});return
    data=RESULT
   elif path.endswith('/leaderboard'):
    calls.append(('ranking',None));data={'promptId':PROMPT['promptId'],'items':[]}
   elif path.endswith('/submission'):calls.append(('detail',None));data={**RESULT,**PROMPT,'createdAt':'','imageDataUrl':IMAGE}
   elif path.endswith('/upload-url'):
    content_type=route.request.post_data_json.get('contentType','image/png');calls.append(('upload-url',content_type));extension='webp' if content_type=='image/webp' else 'png'
    data={'submissionId':'test-flow','imageKey':'draw/prompt-2026-10/test-flow.'+extension,'putUrl':BASE+'/test-upload','promptId':PROMPT['promptId'],'promptText':PROMPT['promptText'],'contentType':content_type}
   else:raise Exception(path)
   await route.fulfill(json=data)
  await context.route('**/*',lambda route: route.continue_() if route.request.url.startswith(BASE) else route.abort())
  await context.route('**/api/draw/**',api)
  await page.goto(BASE+'/draw/play/',wait_until='domcontentloaded')
  await page.evaluate('([prompt,image,pending])=>{sessionStorage.setItem("drawPrompt",JSON.stringify(prompt));sessionStorage.setItem("drawImage",image);sessionStorage.setItem("drawPromptId",prompt.promptId);sessionStorage.setItem("drawPendingSubmission",JSON.stringify(pending));localStorage.setItem("drawSubmissionId","old-submission");localStorage.setItem("drawResultVersion","v6-decisions-async");localStorage.setItem("drawResult",JSON.stringify({submissionId:"old-submission",score:99}));}',[PROMPT,IMAGE,PENDING])
  await page.goto(BASE+'/draw/result?promptId=prompt-2026-10&submissionId=test-flow',wait_until='domcontentloaded')
  try: await asyncio.wait_for(started.wait(),20)
  except: print("DEBUG",errors,await page.locator("body").inner_text()); raise
  await page.get_by_alt_text('投稿した絵',exact=True).wait_for()
  assert page.url.startswith(BASE+'/draw/result')
  assert len([x for x in calls if x[0]=='submit'])==1
  assert not any(x[0]=='ranking' for x in calls)
  assert await page.get_by_text('今日のランキング Top20',exact=True).count()==0
  assert await page.evaluate('JSON.parse(sessionStorage.getItem("drawPendingSubmission")).submissionId')=='test-flow'
  print('PASS: result shows image before score; stale score excluded; one submit; no early ranking')
  started.clear()
  await page.reload(wait_until='domcontentloaded')
  await asyncio.wait_for(started.wait(),10)
  await page.get_by_alt_text('投稿した絵',exact=True).wait_for()
  assert all(x[1]['submissionId']=='test-flow' for x in calls if x[0]=='submit')
  assert not any(x[0]=='ranking' for x in calls)
  print('PASS: reload during scoring reuses the pending submission ID and image')
  release.set()
  await page.wait_for_function('JSON.parse(localStorage.getItem("drawResult")||"{}").score===70')
  await page.wait_for_function('sessionStorage.getItem("drawPendingSubmission")===null')
  await page.wait_for_timeout(1000)
  assert any(x[0]=='ranking' for x in calls)
  before=len([x for x in calls if x[0]=='submit'])
  await page.reload();await page.wait_for_timeout(1000)
  assert len([x for x in calls if x[0]=='submit'])==before
  print('PASS: score completes before ranking; reload reuses saved result without resubmitting')
  await page.evaluate('(pending)=>{sessionStorage.setItem("drawPendingSubmission",JSON.stringify(pending));localStorage.removeItem("drawResult");}',PENDING)
  mode['value']='failure'
  await page.reload();await page.get_by_text('採点できませんでした。少し待って再試行してください。',exact=True).wait_for()
  assert await page.evaluate('sessionStorage.getItem("drawPendingSubmission")!==null')
  mode['value']='success'
  await page.get_by_role('button',name='再試行',exact=True).click()
  await page.wait_for_function('JSON.parse(localStorage.getItem("drawResult")||"{}").score===70')
  submissions=[x[1] for x in calls if x[0]=='submit']
  assert all(x['submissionId']=='test-flow' and x['imageKey']==PENDING['imageKey'] for x in submissions)
  print('PASS: failure retains pending image/key; retry uses identical ID')
  assert not errors,errors
  calls.clear();started.clear();release.clear()
  upload_started=asyncio.Event();upload_release=asyncio.Event()
  async def upload(route):
   content_type=route.request.headers['content-type'];body=route.request.post_data_buffer
   assert content_type==next(x[1] for x in calls if x[0]=='upload-url')
   assert (body[:4]==b'RIFF' and body[8:12]==b'WEBP') if content_type=='image/webp' else body[:8]==b'\x89PNG\r\n\x1a\n'
   calls.append(('put',content_type));upload_started.set();await upload_release.wait();await route.fulfill(status=200,body='')
  await context.route('**/test-upload',upload)
  await page.goto(BASE+'/draw/play/',wait_until='domcontentloaded')
  await page.evaluate('()=>{localStorage.clear();sessionStorage.removeItem("drawPendingSubmission");}')
  await page.clock.install()
  await page.get_by_role('timer').wait_for()
  canvas=page.locator('canvas');await canvas.wait_for()
  box=await canvas.bounding_box()
  await page.mouse.move(box['x']+50,box['y']+50);await page.mouse.down();await page.mouse.move(box['x']+150,box['y']+150,steps=5);await page.mouse.up()
  await page.clock.run_for(31000)
  await asyncio.wait_for(upload_started.wait(),10)
  assert '/draw/play' in page.url
  assert not any(x[0]=='submit' for x in calls)
  print('PASS: upload type matches signed request and actual PNG/WebP bytes; no early submit')
  upload_release.set()
  await page.wait_for_url('**/draw/result?**')
  await asyncio.wait_for(started.wait(),10)
  await page.get_by_alt_text('投稿した絵',exact=True).wait_for()
  assert len([x for x in calls if x[0]=='submit'])==1
  chosen=next(x[1] for x in calls if x[0]=='put');expected_extension='.webp' if chosen=='image/webp' else '.png'
  assert next(x[1] for x in calls if x[0]=='submit')['imageKey'].endswith(expected_extension)
  assert await page.evaluate('(type)=>sessionStorage.getItem("drawImage").startsWith("data:"+type)',chosen)
  assert not any(x[0]=='ranking' for x in calls)
  print('PASS: upload completion navigates immediately; drawing visible while score request remains pending')
  release.set()
  await page.wait_for_function('JSON.parse(localStorage.getItem("drawResult")||"{}").score===70')
  assert not errors,errors
  await browser.close()
asyncio.run(main())
