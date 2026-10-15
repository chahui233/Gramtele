package com.example.yytfsupportsite.yytf.util;

import jakarta.servlet.http.*;
import java.io.IOException;

public final class SocialAuth {
    private SocialAuth() {}
    public static Integer user(HttpServletRequest req, HttpServletResponse resp, boolean mutation) throws IOException {
        HttpSession session = req.getSession(false);
        Integer id = session == null ? null : (Integer) session.getAttribute("userId");
        if (id == null) { resp.sendError(401); return null; }
        // Reuse the random per-login token already used by announcements.
        Object token = session.getAttribute("announcementToken");
        if (mutation && (!(token instanceof String) || !token.equals(req.getHeader("X-CSRF-Token")))) {
            resp.sendError(403); return null;
        }
        resp.setHeader("Cache-Control", "no-store");
        return id;
    }
}
