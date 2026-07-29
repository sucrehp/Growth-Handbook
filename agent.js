const $ = (selector) => document.querySelector(selector);
const state = { file: null, fileData: "", children: [], token: "", config: null };

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  state.config = await publicApi("/api/config");
  if (!state.config.configured) return showLoginError("系统尚未配置公开访问密钥");
  state.token = sessionStorage.getItem("growthbook_agent_token") || "";
  if (state.token) {
    try { await enterWorkspace(); } catch { logout(); }
  }
}

function bindEvents() {
  $("#loginForm").addEventListener("submit", login);
  $("#logoutButton").addEventListener("click", logout);
  $("#photoInput").addEventListener("change", handlePhoto);
  $("#parseButton").addEventListener("click", parseInstruction);
  $("#archiveButton").addEventListener("click", archivePhoto);
  $("#refreshButton").addEventListener("click", loadPhotos);
  $(".examples").addEventListener("click", (event) => {
    if (event.target.tagName === "BUTTON") $("#instruction").value = event.target.textContent;
  });
}

async function login(event) {
  event.preventDefault();
  const button = $("#loginButton");
  setBusy(button, true, "正在登录…");
  try {
    const response = await fetch(`${state.config.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: state.config.publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: $("#email").value.trim(), password: $("#password").value })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error("邮箱或密码不正确");
    state.token = payload.access_token;
    sessionStorage.setItem("growthbook_agent_token", state.token);
    await enterWorkspace();
  } catch (error) {
    showLoginError(error.message);
  } finally {
    setBusy(button, false, "登录成长助手");
  }
}

async function enterWorkspace() {
  state.children = await api("/api/children");
  renderChildOptions(state.children);
  $("#loginScreen").hidden = true;
  $("#appScreen").hidden = false;
  await loadPhotos();
}

function logout() {
  state.token = "";
  sessionStorage.removeItem("growthbook_agent_token");
  $("#appScreen").hidden = true;
  $("#loginScreen").hidden = false;
}

function showLoginError(message) {
  $("#loginError").textContent = message;
  $("#loginError").hidden = false;
}

function handlePhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("请选择图片文件");
  if (file.size > 10 * 1024 * 1024) return toast("照片不能超过 10MB");
  state.file = file;
  const reader = new FileReader();
  reader.onload = () => {
    state.fileData = reader.result;
    $("#preview").src = reader.result;
    $("#preview").hidden = false;
    $("#dropPrompt").hidden = true;
    setStep(2);
  };
  reader.readAsDataURL(file);
}

async function parseInstruction() {
  if (!state.file) return toast("请先选择一张照片");
  const instruction = $("#instruction").value.trim();
  if (!instruction) return toast("请输入归档指令");
  setBusy($("#parseButton"), true, "正在识别…");
  try {
    const parsed = await api("/api/parse", {
      method: "POST",
      body: JSON.stringify({ instruction })
    });
    renderChildOptions(parsed.matches?.length ? parsed.matches : state.children, parsed.matches?.length === 1 ? parsed.matches[0].id : "");
    $("#categorySelect").value = parsed.category;
    $("#description").value = parsed.description;
    $("#confidence").textContent = `识别置信度 ${Math.round(parsed.confidence * 100)}%`;
    $("#clarification").hidden = !parsed.clarification;
    $("#clarification").textContent = parsed.clarification || "";
    $("#resultCard").hidden = false;
    $("#resultCard").scrollIntoView({ behavior: "smooth", block: "center" });
    setStep(3);
  } catch (error) { toast(error.message); }
  finally { setBusy($("#parseButton"), false, "智能识别指令 →"); }
}

async function archivePhoto() {
  const childId = $("#childSelect").value;
  if (!childId) return toast("请选择正确的学员");
  setBusy($("#archiveButton"), true, "正在归档…");
  try {
    const result = await api("/api/archive-photo", {
      method: "POST",
      body: JSON.stringify({
        childId,
        category: $("#categorySelect").value,
        description: $("#description").value.trim(),
        instruction: $("#instruction").value.trim(),
        uploadedBy: $("#uploadedBy").value.trim(),
        fileName: state.file.name,
        fileType: state.file.type,
        fileData: state.fileData
      })
    });
    toast(`${result.message} ✓`);
    resetForm();
    await loadPhotos();
  } catch (error) { toast(error.message); }
  finally { setBusy($("#archiveButton"), false, "确认并存入成长手册 ✓"); }
}

async function loadPhotos() {
  const photos = await api("/api/photos");
  $("#emptyState").hidden = photos.length > 0;
  $("#photoGrid").innerHTML = photos.map(photoCard).join("");
}

function renderChildOptions(children, selected = "") {
  $("#childSelect").innerHTML = '<option value="">请选择学员</option>' + children.map((child) =>
    `<option value="${escapeHtml(child.id)}" ${child.id === selected ? "selected" : ""}>${escapeHtml(child.name)} · ${escapeHtml(child.class_name || "未分班")}</option>`
  ).join("");
}

function photoCard(photo) {
  const child = photo.children || {};
  return `<article class="photo-item"><img src="${escapeHtml(photo.photo_url)}" alt="成长照片" /><div class="photo-meta"><strong>${escapeHtml(child.name || "学员")} · ${escapeHtml(photo.category || "课堂风采")}</strong><span>${escapeHtml(photo.caption || "暂无描述")} · ${formatDate(photo.created_at)}</span></div></article>`;
}

function resetForm() {
  state.file = null; state.fileData = "";
  $("#photoInput").value = ""; $("#preview").hidden = true; $("#dropPrompt").hidden = false;
  $("#instruction").value = ""; $("#resultCard").hidden = true; setStep(1);
}
function setStep(number) { document.querySelectorAll(".step").forEach((step) => step.classList.toggle("active", Number(step.dataset.step) <= number)); }
function setBusy(button, busy, text) { button.disabled = busy; button.textContent = text; }
async function publicApi(url) { const response = await fetch(url); const data = await response.json(); if (!response.ok) throw new Error(data.error || "操作失败"); return data; }
async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${state.token}`, "Content-Type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) logout();
  if (!response.ok) throw new Error(data.error || "操作失败");
  return data;
}
function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2600); }
function formatDate(value) { return value ? new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(value)) : "刚刚"; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
