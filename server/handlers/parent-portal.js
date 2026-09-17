const { send, handleError, requireParent, db } = require("../../api/_lib");

module.exports = async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    if (req.method !== "GET") {
      const error = new Error("请求方式不支持");
      error.statusCode = 405;
      throw error;
    }
    const { user, bindings } = await requireParent(req);
    const childIds = [...new Set(bindings.map((item) => item.child_id))];
    const children = await db(
      `children?select=id,name,gender,birthday,class_name,avatar_url,style_preference,share_token&id=in.(${childIds.map(encodeURIComponent).join(",")})&order=name.asc`
    );
    const childById = new Map(children.map((child) => [child.id, child]));
    const result = bindings
      .map((binding) => {
        const child = childById.get(binding.child_id);
        if (!child) return null;
        return {
          id: child.id,
          name: child.name,
          gender: child.gender,
          birthday: child.birthday,
          className: child.class_name,
          avatarUrl: child.avatar_url,
          stylePreference: child.style_preference,
          portfolioUrl: `/child?t=${encodeURIComponent(child.share_token)}`,
          relation: binding.relation,
          isPrimary: binding.is_primary,
          permissions: {
            editBasic: false,
            replyComments: false,
            uploadGrowth: binding.can_upload_growth
          }
        };
      })
      .filter(Boolean);
    send(res, 200, {
      parent: {
        displayName: user.user_metadata?.display_name || "家长"
      },
      children: result
    });
  } catch (error) {
    handleError(res, error);
  }
};
