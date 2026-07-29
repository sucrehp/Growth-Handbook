const { SUPABASE_URL, PUBLISHABLE_KEY, send, handleError, requireMethod } = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    requireMethod(req, "GET");
    send(res, 200, {
      supabaseUrl: SUPABASE_URL,
      publishableKey: PUBLISHABLE_KEY,
      configured: Boolean(SUPABASE_URL && PUBLISHABLE_KEY)
    });
  } catch (error) {
    handleError(res, error);
  }
};
