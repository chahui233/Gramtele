package com.example.yytfsupportsite.yytf.servlet;

import com.google.gson.Gson;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** Chat pages renew presence every ten seconds, independent of WebSocket/proxy support. */
@WebServlet("/online-users")
public class OnlineUsersServlet extends HttpServlet {
    private static final long EXPIRY_MS = 35000;
    private final Map<String, Presence> sessions = new ConcurrentHashMap<>();
    private record Presence(HttpSession session, int userId, long seenAt) {}

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        HttpSession session = req.getSession(false);
        Integer id = session == null ? null : (Integer) session.getAttribute("userId");
        if (id == null) { resp.sendError(401); return; }
        long now = System.currentTimeMillis();
        sessions.put(session.getId(), new Presence(session, id, now));
        resp.setHeader("Cache-Control", "no-store");
        resp.setContentType("application/json;charset=UTF-8");
        resp.getWriter().write(new Gson().toJson(snapshot(now)));
    }

    List<Map<String, Object>> snapshot(long now) {
        Map<Integer, Map<String, Object>> users = new TreeMap<>();
        sessions.forEach((key, presence) -> {
            try {
                if (now - presence.seenAt() >= EXPIRY_MS
                        || !Integer.valueOf(presence.userId()).equals(presence.session().getAttribute("userId"))) {
                    sessions.remove(key, presence);
                    return;
                }
                String username = (String) presence.session().getAttribute("username");
                String name = (String) presence.session().getAttribute("displayName");
                if (name == null || name.isBlank()) name = username;
                users.put(presence.userId(), Map.of("id", presence.userId(),
                        "name", name == null ? "用户" : name, "username", username == null ? "" : username));
            } catch (IllegalStateException expired) {
                sessions.remove(key, presence);
            }
        });
        return new ArrayList<>(users.values());
    }
}
