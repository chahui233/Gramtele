package com.example.yytfsupportsite.yytf.servlet;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.sql.*;
import com.example.yytfsupportsite.yytf.util.DBUtil;

@WebServlet("/AddFriendServlet")
public class AddFriendServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("text/plain;charset=UTF-8");

        // 获取当前登录用户 ID
        HttpSession session = request.getSession();
        Integer userId = (Integer) session.getAttribute("userId");

        if (userId == null) {
            System.out.println("[AddFriendServlet] session 中 userId 为 null");
            response.getWriter().print("error");
            return;
        }

        // 获取并验证 friendId 参数
        String friendIdStr = request.getParameter("friendId");
        if (friendIdStr == null || friendIdStr.trim().isEmpty()) {
            System.out.println("[AddFriendServlet] 参数 friendId 为空");
            response.getWriter().print("error");
            return;
        }

        int friendId;
        try {
            friendId = Integer.parseInt(friendIdStr);
        } catch (NumberFormatException e) {
            System.out.println("[AddFriendServlet] friendId 不是合法数字：" + friendIdStr);
            response.getWriter().print("error");
            return;
        }

        if (friendId == userId) {
            System.out.println("[AddFriendServlet] 不能添加自己为好友：userId = " + userId);
            response.getWriter().print("error");
            return;
        }

        try (Connection conn = DBUtil.getConnection()) {

            // 检查是否已经是好友
            PreparedStatement checkStmt = conn.prepareStatement(
                    "SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)"
            );
            checkStmt.setInt(1, userId);
            checkStmt.setInt(2, friendId);
            checkStmt.setInt(3, friendId);
            checkStmt.setInt(4, userId);
            ResultSet rs = checkStmt.executeQuery();

            if (rs.next()) {
                response.getWriter().print("already");
                return;
            }

            // 添加为双向好友
            PreparedStatement insertStmt = conn.prepareStatement(
                    "INSERT INTO friends (user_id, friend_id) VALUES (?, ?), (?, ?)"
            );
            insertStmt.setInt(1, userId);
            insertStmt.setInt(2, friendId);
            insertStmt.setInt(3, friendId);
            insertStmt.setInt(4, userId);
            insertStmt.executeUpdate();

            response.getWriter().print("success");

        } catch (Exception e) {
            e.printStackTrace();
            response.getWriter().print("error");
        }
    }
}
