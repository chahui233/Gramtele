package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;

@WebServlet("/DeleteFriendServlet")
public class DeleteFriendServlet extends HttpServlet {
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        request.setCharacterEncoding("UTF-8");
        HttpSession session = request.getSession(false);
        Integer userId = (Integer) session.getAttribute("userId");

        String fidStr = request.getParameter("friendId");
        if (userId == null || fidStr == null) {
            response.getWriter().write("无效请求");
            return;
        }

        try {
            int fid = Integer.parseInt(fidStr);
            Connection conn = DBUtil.getConnection();

            PreparedStatement ps = conn.prepareStatement(
                    "DELETE FROM friends WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)"
            );
            ps.setInt(1, userId);
            ps.setInt(2, fid);
            ps.setInt(3, fid);
            ps.setInt(4, userId);

            int rows = ps.executeUpdate();
            ps.close();
            conn.close();

            response.getWriter().write(rows > 0 ? "好友已删除" : "删除失败");
        } catch (Exception e) {
            e.printStackTrace();
            response.getWriter().write("服务器错误");
        }
    }
}
