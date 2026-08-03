const $ = (selector) => document.querySelector(selector);
const state = { token:"", refreshToken:"", me:null, config:null, overview:null, leads:[], contracts:[], accounts:[], tasks:[], campuses:[] };
const titles = { overview:"经营总览", leads:"招生客户", contracts:"合同收费", accounts:"课时账户", tasks:"任务中心", growth:"成长手册" };

document.addEventListener("DOMContentLoaded", init);
async function init(){
  bind();
  state.config = await publicApi("/api/config");
  state.token = localStorage.getItem("edu_access_token") || sessionStorage.getItem("growthbook_agent_token") || "";
  state.refreshToken = localStorage.getItem("edu_refresh_token") || "";
  $("#today").textContent = new Intl.DateTimeFormat("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"long"}).format(new Date());
  if(state.token){ try{ await enter(); }catch{ logout(); } }
}
function bind(){
  $("#loginForm").addEventListener("submit",login);
  $("#logout").addEventListener("click",logout);
  document.querySelectorAll("nav button[data-view]").forEach(button=>button.addEventListener("click",()=>showView(button.dataset.view)));
  document.querySelectorAll("[data-open]").forEach(button=>button.addEventListener("click",()=>document.getElementById(button.dataset.open).showModal()));
  document.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>button.closest("dialog").close()));
  $("#leadForm").addEventListener("submit",event=>saveForm(event,"leads"));
  $("#contractForm").addEventListener("submit",event=>saveForm(event,"contracts"));
  $("#taskForm").addEventListener("submit",event=>saveForm(event,"tasks"));
}
async function login(event){
  event.preventDefault();
  const response=await fetch(`${state.config.supabaseUrl}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:state.config.publishableKey,"Content-Type":"application/json"},body:JSON.stringify({email:$("#email").value.trim(),password:$("#password").value})});
  const payload=await response.json();
  if(!response.ok){$("#loginError").textContent="邮箱或密码不正确";$("#loginError").hidden=false;return}
  state.token=payload.access_token;
  state.refreshToken=payload.refresh_token || "";
  localStorage.setItem("edu_access_token",state.token);
  localStorage.setItem("edu_refresh_token",state.refreshToken);
  sessionStorage.setItem("growthbook_agent_token",state.token);
  await enter();
}
async function enter(){
  state.me=await api("/api/edu-me");
  if(state.me.accountType==="parent"){location.href="/parent";return}
  applyPermissions();
  $("#loginScreen").hidden=true;$("#app").hidden=false;
  await loadAll();showView("overview");
}
function logout(){state.token="";state.refreshToken="";localStorage.removeItem("edu_access_token");localStorage.removeItem("edu_refresh_token");sessionStorage.removeItem("growthbook_agent_token");$("#app").hidden=true;$("#loginScreen").hidden=false}
async function loadAll(){
  [state.overview,state.leads,state.contracts,state.accounts,state.tasks,state.campuses]=await Promise.all([
    api("/api/edu-overview"),
    resource("leads"),resource("contracts"),resource("accounts"),resource("tasks"),resource("campuses")
  ]);
  renderOverview();renderLeads();renderContracts();renderAccounts();renderTasks();
}
function showView(name){
  document.querySelectorAll(".view").forEach(view=>view.classList.remove("active"));
  document.getElementById(`${name}View`).classList.add("active");
  document.querySelectorAll("nav button[data-view]").forEach(button=>button.classList.toggle("active",button.dataset.view===name));
  $("#viewTitle").textContent=titles[name];
  if(name==="growth"&&!$("#growthFrame").src)$("#growthFrame").src="/admin?embedded=1";
}
function applyPermissions(){
  const modules=new Set(state.me?.modules||[]);
  document.querySelectorAll("[data-module]").forEach(element=>element.hidden=!modules.has(element.dataset.module));
  document.querySelectorAll("nav button[data-view]").forEach(element=>{
    const view=element.dataset.view;
    if(["overview","tasks"].includes(view))element.hidden=!modules.has(view);
  });
}
function renderOverview(){
  const o=state.overview;
  const cards=[
    ["在册学员",o.students,"#7fb8a9"],["跟进中客户",o.leads,"#e8a16e"],["已签合同",o.signedContracts,"#8b9fd0"],["待办任务",o.todoTasks,"#d88888"],
    ["合同总额",money(o.contractAmount),"#a78bc1"],["已收金额",money(o.collectedAmount),"#6da6c1"],["剩余课时",format(o.remainingLessons),"#d7b459"],["紧急任务",o.urgentTasks,"#c96666"]
  ];
  $("#kpis").innerHTML=cards.map(item=>`<article class="kpi" style="--accent:${item[2]}"><span>${item[0]}</span><strong>${item[1]}</strong></article>`).join("");
  const alerts=[];
  if(o.urgentTasks)alerts.push([`${o.urgentTasks}项紧急任务待处理`,"请优先进入任务中心处理"]);
  if(o.contractAmount>o.collectedAmount)alerts.push([`待收款 ${money(o.contractAmount-o.collectedAmount)}`,"合同金额与已收金额存在差额"]);
  if(!alerts.length)alerts.push(["目前没有紧急异常","核心数据运行正常"]);
  $("#alerts").innerHTML=alerts.map(item=>`<div class="alert"><strong>${item[0]}</strong><span>${item[1]}</span></div>`).join("");
}
function renderLeads(){
  $("#leadsBody").innerHTML=state.leads.length?state.leads.map(item=>`<tr><td><strong>${e(item.parent_name)}</strong>${e(item.child_name||"未填孩子姓名")}</td><td>${e(item.phone)}</td><td>${e(item.source||"-")}</td><td>${e(item.interested_course||"-")}</td><td><span class="badge ${item.intention_level==="high"?"orange":""}">${name({high:"高",medium:"中",low:"低"},item.intention_level)}</span></td><td>${name({new:"新客户",contacted:"已联系",trial_booked:"已约试听",trial_done:"试听完成",won:"已报名",lost:"已流失"},item.stage)}</td><td>${date(item.next_followup_at)}</td></tr>`).join(""):emptyRow(7);
}
function renderContracts(){
  $("#contractsBody").innerHTML=state.contracts.length?state.contracts.map(item=>`<tr><td><strong>${e(item.contract_no)}</strong></td><td>${e(item.children?.name||"-")} / ${e(item.guardian_name)}</td><td>${e(item.course_category)}</td><td>${format(item.total_lessons)} + ${format(item.gift_lessons)}赠</td><td>${money(item.contract_amount)}</td><td>${money(item.paid_amount)}</td><td><span class="badge ${item.sign_status==="pending"?"orange":""}">${name({draft:"草稿",pending:"待签",signed:"已签",voided:"作废",expired:"过期"},item.sign_status)}</span></td><td>${date(item.valid_until)}</td></tr>`).join(""):emptyRow(8);
}
function renderAccounts(){
  $("#accountsBody").innerHTML=state.accounts.length?state.accounts.map(item=>{const balance=Number(item.purchased_lessons||0)+Number(item.gift_lessons||0)-Number(item.consumed_lessons||0)-Number(item.frozen_lessons||0);return `<tr><td><strong>${e(item.children?.name||"-")}</strong></td><td>${e(item.edu_contracts?.contract_no||"-")}</td><td>${e(item.course_category)}</td><td>${format(item.purchased_lessons)}</td><td>${format(item.gift_lessons)}</td><td>${format(item.consumed_lessons)}</td><td><strong>${format(balance)}</strong></td><td><span class="badge">${name({active:"有效",frozen:"冻结",expired:"过期",closed:"关闭"},item.status)}</span></td></tr>`}).join(""):emptyRow(8);
}
function renderTasks(){
  const groups={todo:["待处理"],doing:["进行中"],waiting:["等待中"],done:["已完成"]};
  $("#taskBoard").innerHTML=Object.entries(groups).map(([status,label])=>`<section class="task-column"><h3>${label[0]} · ${state.tasks.filter(item=>item.status===status).length}</h3>${state.tasks.filter(item=>item.status===status).map(item=>`<article class="task-card"><strong>${e(item.title)}</strong><span>${name({urgent:"紧急",high:"高",normal:"普通",low:"低"},item.priority)} · ${date(item.due_at)}</span></article>`).join("")}</section>`).join("");
}
async function saveForm(event,resourceName){
  event.preventDefault();
  const form=event.currentTarget;const data=Object.fromEntries(new FormData(form));
  Object.keys(data).forEach(key=>{if(data[key]==="")delete data[key]});
  await api("/api/edu-core",{method:"POST",body:JSON.stringify({resource:resourceName,data})});
  form.closest("dialog").close();form.reset();toast("保存成功");await loadAll();
}
async function resource(name){return api(`/api/edu-core?resource=${name}`)}
async function publicApi(url){const response=await fetch(url);const data=await response.json();if(!response.ok)throw new Error(data.error||"加载失败");return data}
async function api(url,options={}){const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${state.token}`,"Content-Type":"application/json",...(options.headers||{})}});const data=await response.json().catch(()=>({}));if(response.status===401)logout();if(!response.ok)throw new Error(data.error||"操作失败");return data}
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2400)}
function emptyRow(cols){return `<tr><td colspan="${cols}" style="text-align:center;color:#87908b;padding:35px">暂无数据</td></tr>`}
function e(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function date(value){return value?new Intl.DateTimeFormat("zh-CN",{year:"numeric",month:"numeric",day:"numeric"}).format(new Date(value)):"-"}
function money(value){return `¥${Number(value||0).toLocaleString("zh-CN",{maximumFractionDigits:2})}`}
function format(value){return Number(value||0).toLocaleString("zh-CN",{maximumFractionDigits:2})}
function name(map,value){return map[value]||value||"-"}
