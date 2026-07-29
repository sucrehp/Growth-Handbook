const { send, handleError, requireUser, db } = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    await requireUser(req);
    if (req.method === "GET") {
      const rows = await db(
        "content_drafts?select=*,marketing_materials(*)&order=created_at.desc&limit=100"
      );
      return send(res, 200, rows);
    }
    if (req.method !== "POST") {
      const error = new Error("请求方式不支持");
      error.statusCode = 405;
      throw error;
    }

    const materialId = req.body?.materialId;
    const materials = await db(
      `marketing_materials?select=*&id=eq.${encodeURIComponent(materialId)}&limit=1`
    );
    if (!materials.length) {
      const error = new Error("素材不存在");
      error.statusCode = 404;
      throw error;
    }
    const material = materials[0];
    if (material.consent_status !== "granted" || material.privacy_status !== "passed") {
      const error = new Error("素材尚未通过家长授权与隐私检查，不能生成发布稿");
      error.statusCode = 409;
      throw error;
    }

    const drafts = createDrafts(material);
    const rows = await db("content_drafts?on_conflict=material_id,platform", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(drafts)
    });
    send(res, 201, rows);
  } catch (error) {
    handleError(res, error);
  }
};

function createDrafts(material) {
  const activity = material.activity_name || "今日课堂";
  const course = material.course_category || "成长课程";
  const campus = material.campus || "阿墨逗儿童成长中心";
  const detail = material.original_text || "孩子们在探索、表达与合作中收获了新的成长。";
  const assetUrls = material.file_url ? [material.file_url] : [];

  return [
    {
      material_id: material.id,
      platform: "moments",
      title: `${activity}｜成长瞬间`,
      body: `今天的${activity}里，孩子们在${course}中认真探索、勇敢表达。\n\n${detail}\n\n每一次专注，都是成长正在发生。`,
      hashtags: [],
      cover_brief: "优先选择表情自然、画面干净、能体现互动过程的照片，建议3—9张。",
      asset_urls: assetUrls,
      generation_mode: "template",
      review_status: "draft"
    },
    {
      material_id: material.id,
      platform: "xiaohongshu",
      title: `原来孩子的成长，藏在${activity}的这些瞬间里`,
      body: `在${campus}的${activity}中，我们没有急着给出答案，而是让孩子在${course}里自己观察、尝试和表达。\n\n${detail}\n\n比完成作品更珍贵的，是孩子愿意主动思考、与同伴合作，并把自己的想法说出来。`,
      hashtags: ["儿童成长", "素质教育", course, activity].filter(Boolean),
      cover_brief: "3:4竖版封面；标题控制在两行；避免出现未授权儿童正脸和个人信息。",
      asset_urls: assetUrls,
      generation_mode: "template",
      review_status: "draft"
    },
    {
      material_id: material.id,
      platform: "douyin",
      title: `孩子在${activity}里悄悄练会了什么？`,
      body: `${detail}\n#儿童成长 #${course} #${activity}`,
      hashtags: ["儿童成长", course, activity].filter(Boolean),
      cover_brief: "9:16竖版；封面使用动作明确的画面；主标题不超过14字。",
      video_script: `0—3秒：孩子专注操作的特写，字幕“这不是普通的一节课”。\n3—12秒：展示${activity}的探索过程，字幕“观察、尝试、合作、表达”。\n12—20秒：作品或互动成果，字幕“成长发生在每一次主动尝试里”。\n结尾：${campus}名称与活动信息。`,
      asset_urls: assetUrls,
      generation_mode: "template",
      review_status: "draft"
    }
  ];
}
