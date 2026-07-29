const $ = (selector) => document.querySelector(selector);
const state = { token: "", config: null, fileData: "", file: null, drafts: [], schedules: [] };
const platformNames = { moments: "微信朋友圈", xiaohongshu: "小红书", douyin: "抖音" };

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bind();
  state.config = await publicApi("/api/config");
  state.token = sessionStorage.getItem("growthbook_agent_token") || "";
  if (state.token) {
    try { await enter(); } catch { logout(); }
  }
}

function bind() {
  $("#loginForm").addEventListener("submit", login);
  $("#logout").addEventListener("click", logout);
  $("#mediaFile").addEventListener("change", readFile);
  $("#materialForm").addEventListener("submit", saveMaterial);
  $("#refreshDrafts").addEventListener("click", loadAll);
  $("#drafts").addEventListener("click", handleDraftAction);
}

async function login(event) {
  event.preventDefault();
  const response = await fetch(`${state.config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: state.config.publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: $("#email").value.trim(), password: $("#password").value })
  });
  const payload = await response.json();
  if (!response.ok) {
    $("#loginError").textContent = "邮箱或密码不正确";
    $("#loginError").hidden = false;
    return;
  }
  state.token = payload.access_token;
  sessionStorage.setItem("growthbook_agent_token", state.token);
  await enter();
}

async function enter() {
  $("#loginScreen").hidden = true;
  $("#workspace").hidden = false;
  await loadAll();
}

function logout() {
  state.token = "";
  sessionStorage.removeItem("growthbook_agent_token");
  $("#workspace").hidden = true;
  $("#loginScreen").hidden = false;
}

function readFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 12 * 1024 * 1024) return toast("当前版本单个素材不能超过 12MB");
  state.file = file;
  $("#fileLabel").textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)}MB`;
  const reader = new FileReader();
  reader.onload = () => { state.fileData = reader.result; };
  reader.readAsDataURL(file);
}

async function saveMaterial(event) {
  event.preventDefault();
  const button = event.submitter;
  busy(button, true, "正在生成三个平台版本…");
  try {
    const material = await api("/api/marketing-materials", {
      method: "POST",
      body: JSON.stringify({
        materialType: state.file?.type.startsWith("video") ? "video" : state.file ? "photo" : "text",
        fileData: state.fileData,
        fileName: state.file?.name,
        fileType: state.file?.type,
        activityName: $("#activityName").value,
        courseCategory: $("#courseCategory").value,
        campus: $("#campus").value,
        originalText: $("#originalText").value,
        consentConfirmed: $("#consentConfirmed").checked
      })
    });
    if (!$("#consentConfirmed").checked) {
      toast("素材已保存为待隐私检查，确认授权后才能生成发布稿");
    } else {
      await api("/api/marketing-drafts", {
        method: "POST",
        body: JSON.stringify({ materialId: material.id })
      });
      toast("三个平台的发布稿已生成");
    }
    resetMaterial();
    await loadAll();
  } catch (error) { toast(error.message); }
  finally { busy(button, false, "保存素材并生成发布稿"); }
}

async function loadAll() {
  [state.drafts, state.schedules] = await Promise.all([
    api("/api/marketing-drafts"),
    api("/api/marketing-schedules")
  ]);
  renderDrafts();
  renderSchedules();
}

function renderDrafts() {
  if (!state.drafts.length) return $("#drafts").innerHTML = '<p class="empty">还没有发布稿。</p>';
  $("#drafts").innerHTML = state.drafts.map((draft) => `
    <article class="draft">
      <div class="platform"><strong>${platformNames[draft.platform]}</strong><span class="pill">${statusName(draft.review_status)}</span></div>
      <h3>${escapeHtml(draft.title || "未命名发布稿")}</h3>
      <pre>${escapeHtml(draft.body)}</pre>
      ${draft.video_script ? `<details><summary>查看视频脚本</summary><pre>${escapeHtml(draft.video_script)}</pre></details>` : ""}
      <div class="actions">
        <button data-action="copy" data-id="${draft.id}">复制文案</button>
        <button class="approve" data-action="approve" data-id="${draft.id}">审核通过</button>
        ${draft.review_status === "approved" ? `<button data-action="schedule" data-id="${draft.id}">安排发布</button>` : ""}
      </div>
      ${draft.review_status === "approved" ? `
        <form class="schedule-form" data-schedule="${draft.id}">
          <input name="time" type="datetime-local" required />
          <input name="name" placeholder="发布负责人" required />
          <input name="phone" placeholder="手机号码（可选）" />
          <button class="primary" type="submit">保存排期</button>
        </form>` : ""}
    </article>`).join("");
  document.querySelectorAll("[data-schedule]").forEach((form) => form.addEventListener("submit", scheduleDraft));
}

async function handleDraftAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const draft = state.drafts.find((item) => item.id === button.dataset.id);
  if (!draft) return;
  if (button.dataset.action === "copy") {
    await navigator.clipboard.writeText(`${draft.title}\n\n${draft.body}`);
    return toast("文案已复制");
  }
  if (button.dataset.action === "approve") {
    await api("/api/marketing-review", {
      method: "POST",
      body: JSON.stringify({ draftId: draft.id, status: "approved" })
    });
    toast("已审核通过，可以安排发布");
    await loadAll();
  }
}

async function scheduleDraft(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  await api("/api/marketing-schedules", {
    method: "POST",
    body: JSON.stringify({
      draftId: form.dataset.schedule,
      scheduledAt: data.get("time"),
      assigneeName: data.get("name"),
      assigneePhone: data.get("phone"),
      reminderChannel: data.get("phone") ? "sms" : "in_app",
      reminderMinutes: 30
    })
  });
  toast("排期已保存，将提前30分钟提醒");
  await loadAll();
}

function renderSchedules() {
  if (!state.schedules.length) return $("#schedules").innerHTML = '<p class="empty">还没有排期。</p>';
  $("#schedules").innerHTML = state.schedules.map((item) => `
    <article class="schedule">
      <div><strong>${platformNames[item.content_drafts?.platform] || "内容发布"}</strong><p>${escapeHtml(item.content_drafts?.title || "")}</p></div>
      <div><strong>${formatTime(item.scheduled_at)}</strong><p>${escapeHtml(item.assignee_name)} · ${item.assignee_phone ? "手机提醒待接通" : "站内提醒"}</p></div>
      <span class="pill">${item.publish_status === "published" ? "已发布" : "待发布"}</span>
    </article>`).join("");
}

function resetMaterial() {
  state.file = null; state.fileData = "";
  $("#mediaFile").value = ""; $("#fileLabel").textContent = "选择照片或视频";
  $("#activityName").value = ""; $("#courseCategory").value = ""; $("#originalText").value = "";
  $("#consentConfirmed").checked = false;
}
function busy(button, value, text) { if (!button) return; button.disabled = value; button.textContent = text; }
function statusName(value) { return ({ draft: "待审核", pending: "审核中", approved: "已通过", rejected: "已退回" })[value] || value; }
function formatTime(value) { return new Intl.DateTimeFormat("zh-CN", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" }).format(new Date(value)); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function toast(message) { const el=$("#toast"); el.textContent=message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("show"),2800); }
async function publicApi(url) { const response=await fetch(url); const data=await response.json(); if(!response.ok) throw new Error(data.error||"操作失败"); return data; }
async function api(url, options={}) {
  const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${state.token}`,"Content-Type":"application/json",...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(response.status===401) logout();
  if(!response.ok) throw new Error(data.error||"操作失败");
  return data;
}
