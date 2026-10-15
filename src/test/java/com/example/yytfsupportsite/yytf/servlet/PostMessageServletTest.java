package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;
import jakarta.servlet.ServletConfig;
import jakarta.servlet.ServletContext;
import jakarta.servlet.http.*;
import org.junit.jupiter.api.Test;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PostMessageServletTest {
    private HttpServletRequest request(String content) {
        var request = mock(HttpServletRequest.class);
        var session = mock(HttpSession.class);
        when(request.getSession(false)).thenReturn(session);
        when(session.getAttribute("userId")).thenReturn(7);
        when(request.getParameter("content")).thenReturn(content);
        return request;
    }

    @Test void rejectsMissingEmptyWhitespaceAndInvisibleOnlyBeforeOpeningDatabase() throws Exception {
        String[] invalid = {null, "", " \t\r\n", "\u00a0\u202f\u3000", "\u200b\u200c\u200d\ufeff",
                "\u2060\u034f\ufe0f", "\u115f\u1160\u3164\uffa0", "\u0000\u001f", "\uDB40\uDD00"};
        try (var db = mockStatic(DBUtil.class)) {
            for (String content : invalid) {
                var response = mock(HttpServletResponse.class);
                var output = new StringWriter();
                when(response.getWriter()).thenReturn(new PrintWriter(output));
                new PostMessageServlet().doPost(request(content), response);
                verify(response).setStatus(400);
                assertEquals("留言内容不能为空。", output.toString());
                verify(response, never()).sendRedirect(anyString());
            }
            db.verifyNoInteractions();
        }
    }

    @Test void preservesVisibleMultilineLongUrlsAndEmojiExactly() throws Exception {
        String[] valid = {"你好", "  第一行\n\n第二行  ", "https://example.com/" + "a".repeat(1500),
                "👩🏽‍💻", "\u200b内容\u00a0", "<b>普通文本</b>"};
        for (String content : valid) {
            var response = mock(HttpServletResponse.class);
            var connection = mock(Connection.class);
            var statement = mock(PreparedStatement.class);
            when(connection.prepareStatement(anyString())).thenReturn(statement);
            try (var db = mockStatic(DBUtil.class)) {
                db.when(DBUtil::getConnection).thenReturn(connection);
                new PostMessageServlet().doPost(request(content), response);
            }
            verify(statement).setInt(1, 7);
            verify(statement).setString(2, content);
            verify(statement).executeUpdate();
            verify(statement).close();
            verify(connection).close();
            verify(response).sendRedirect("home.jsp");
        }
    }

    @Test void rejectsRequestsWithoutALoggedInUser() throws Exception {
        var response = mock(HttpServletResponse.class);
        try (var db = mockStatic(DBUtil.class)) {
            new PostMessageServlet().doPost(mock(HttpServletRequest.class), response);
            verify(response).sendError(401);
            db.verifyNoInteractions();
        }
    }

    @Test void databaseFailureReturnsAnErrorWithoutClaimingSuccess() throws Exception {
        var response = mock(HttpServletResponse.class);
        var output = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(output));
        var config = mock(ServletConfig.class);
        when(config.getServletContext()).thenReturn(mock(ServletContext.class));
        var servlet = new PostMessageServlet();
        servlet.init(config);
        try (var db = mockStatic(DBUtil.class)) {
            db.when(DBUtil::getConnection).thenThrow(new SQLException("internal database detail"));
            servlet.doPost(request("测试留言"), response);
        }
        verify(response).setStatus(503);
        verify(response, never()).sendRedirect(anyString());
        assertEquals("留言发布失败，请稍后重试。", output.toString());
    }
}
