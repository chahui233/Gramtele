
package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.*;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.util.Set;

@WebServlet("/UpdateProfileServlet")
@MultipartConfig
public class UpdateProfileServlet extends HttpServlet {
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        request.setCharacterEncoding("UTF-8");
        HttpSession session = request.getSession();
        Integer userId = (Integer) session.getAttribute("userId");
        if (userId == null) {
            response.sendRedirect("login.jsp");
            return;
        }

        String displayName = request.getParameter("displayName");
        Part part = request.getPart("avatar");
        String avatarUrl = null;

        if (part != null && part.getSize() > 0) {
            // 设置外部路径
            String savePath = "/www/avatar";
            File saveDir = new File(savePath);
            if (!saveDir.exists()) {
                saveDir.mkdirs();
            }

            String submittedFileName = Paths.get(part.getSubmittedFileName()).getFileName().toString();
            String extension = submittedFileName.lastIndexOf('.') >= 0
                    ? submittedFileName.substring(submittedFileName.lastIndexOf('.')).toLowerCase() : "";
            if (part.getSize() > 5 * 1024 * 1024L ||
                    !Set.of(".jpg", ".jpeg", ".png", ".gif", ".webp").contains(extension)) {
                response.sendError(HttpServletResponse.SC_BAD_REQUEST, "头像格式或大小不合法");
                return;
            }
            String newFileName = "avatar_user_" + userId + "_" + System.currentTimeMillis() + extension;
            String fullPath = savePath + File.separator + newFileName;
            part.write(fullPath);

            // 保存数据库路径（相对路径）
            avatarUrl = "/avatar/" + newFileName;
        }

        try (Connection conn = DBUtil.getConnection()) {
            PreparedStatement ps = conn.prepareStatement(avatarUrl == null
                    ? "UPDATE users SET display_name=? WHERE id=?"
                    : "UPDATE users SET display_name=?, avatar=? WHERE id=?");
            ps.setString(1, displayName);
            if (avatarUrl == null) ps.setInt(2, userId);
            else { ps.setString(2, avatarUrl); ps.setInt(3, userId); }
            ps.executeUpdate();
            session.setAttribute("displayName", displayName);
            if (avatarUrl != null) session.setAttribute("avatar", avatarUrl);
        } catch (Exception e) {
            getServletContext().log("Profile update failed", e);
            response.sendError(HttpServletResponse.SC_SERVICE_UNAVAILABLE, "资料保存失败，请稍后重试");
            return;
        }

        response.sendRedirect("profile.jsp");
    }
}
