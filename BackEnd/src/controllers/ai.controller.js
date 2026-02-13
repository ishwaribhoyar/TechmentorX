const aiService = require("../services/ai.service")


module.exports.getReview = async (req, res) => {
    try {
        const code = req.body.code;

        if (!code) {
            return res.status(400).json({ error: "Code is required" });
        }

        const response = await aiService(code);
        res.json({ review: response });
    } catch (error) {
        console.error('[AI Controller] Error:', error.message);
        res.status(500).json({ error: error.message || 'AI service error' });
    }
}
