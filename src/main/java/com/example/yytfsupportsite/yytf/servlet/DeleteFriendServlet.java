package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.*;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.sql.*;

@WebServlet("/DeleteFriendServlet")
public class DeleteFriendServlet extends HttpServlet {
    @Override protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        Integer userId = SocialAuth.user(req, resp, true);
        if (userId == null) return;
        int friendId;
        try { friendId = Integer.parseInt(req.getParameter("friendId")); }
        catch (NumberFormatException e) { resp.sendError(400); return; }
        if (friendId <= 0 || friendId == userId) { resp.sendError(400); return; }
        try (Connection c = DBUtil.getConnection()) {
            String result = FriendRequests.delete(c, userId, friendId) ? "好友已删除" : "你们已不是好友";
            resp.setContentType("text/plain;charset=UTF-8");
            resp.getWriter().write(result);
        } catch (SQLException e) {
            getServletContext().log("Friend operation failed; check friend-requests.sql migration", e);
            resp.sendError(503);
        }
    }
}
