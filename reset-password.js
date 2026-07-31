const form = document.querySelector("#resetForm");
const result = document.querySelector("#result");
const hint = document.querySelector("#hint");
const params = new URLSearchParams(location.hash.slice(1));
const accessToken = params.get("access_token");
const errorDescription = params.get("error_description");

if (!accessToken) {
  form.hidden = true;
  show(
    errorDescription
      ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
      : "密码重置链接无效或已经过期，请重新发送恢复邮件。",
    true
  );
  hint.textContent = "当前链接无法用于设置密码。";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = document.querySelector("#password").value;
  const confirmation = document.querySelector("#confirmPassword").value;
  if (password !== confirmation) {
    show("两次输入的密码不一致。", true);
    return;
  }

  const button = form.querySelector("button");
  button.disabled = true;
  button.textContent = "正在修改…";
  try {
    const configResponse = await fetch("/api/config");
    const config = await configResponse.json();
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.msg || payload.message || "密码修改失败");
    form.hidden = true;
    hint.textContent = "密码已经更新。";
    show("修改成功，现在可以返回 EDU 运营智能体登录。");
    history.replaceState(null, "", "/reset-password");
  } catch (error) {
    show(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "确认修改密码";
  }
});

function show(message, isError = false) {
  result.textContent = message;
  result.hidden = false;
  result.classList.toggle("error", isError);
}
