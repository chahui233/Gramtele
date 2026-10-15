package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.*;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.junit.jupiter.api.Test;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RegisterServletTest {
    private static final String VALID = "V-VII-may-2024-6-29aaaaaaaaa😀";
    private static final String SALT = "0123456789abcdef0123456789abcdef";
    private static RegistrationChallenge.Challenge solved() {
        return new RegistrationChallenge.Challenge("a".repeat(32), SALT,
                RegistrationChallenge.digest(SALT, VALID).substring(0,12), System.currentTimeMillis()+60000);
    }
    private static class Attempt {
        final HttpServletRequest req=mock(HttpServletRequest.class);
        final HttpServletResponse resp=mock(HttpServletResponse.class);
        final HttpSession session=mock(HttpSession.class);
        final RequestDispatcher dispatcher=mock(RequestDispatcher.class);
        final Map<String,Object> attributes=new HashMap<>();
        Attempt() {
            attributes.put(RegistrationChallenge.SESSION_KEY,solved());
            when(req.getSession(false)).thenReturn(session);
            when(req.getParameter("challengeId")).thenReturn("a".repeat(32));
            when(req.getParameter("username")).thenReturn("new-user");
            when(req.getParameter("password")).thenReturn(VALID);
            when(req.getContextPath()).thenReturn("/test");
            when(req.getRequestDispatcher("/register.jsp")).thenReturn(dispatcher);
            when(session.getAttribute(anyString())).thenAnswer(inv->attributes.get(inv.getArgument(0)));
            doAnswer(inv->{attributes.remove(inv.getArgument(0));return null;}).when(session).removeAttribute(anyString());
        }
    }
    @Test void bypassingTheBrowserCannotRegisterAnInvalidPassword() throws Exception {
        var req = mock(HttpServletRequest.class);
        var resp = mock(HttpServletResponse.class);
        var dispatcher = mock(RequestDispatcher.class);
        when(req.getRequestDispatcher("/register.jsp")).thenReturn(dispatcher);
        when(req.getParameter("username")).thenReturn("new-user");
        String oversizedPrefix = "V-VII-may-2024-39-1031";
        String oversized = oversizedPrefix + "a".repeat(1031 - oversizedPrefix.length());
        assertTrue(RegistrationPasswordRules.evaluate(oversized).passes());
        for (String password : new String[]{"Password123!", "V-VII-may-2024-6-29aaaaaaaaaa!", oversized}) {
            when(req.getParameter("password")).thenReturn(password);
            try (var db = mockStatic(DBUtil.class)) {
                new RegisterServlet().doPost(req, resp);
                db.verifyNoInteractions();
            }
        }
        verify(dispatcher, times(3)).forward(req, resp);
        verify(resp, never()).sendRedirect(anyString());
    }

    @Test void validUnicodePasswordIsHashedExactlyAndCanBeVerifiedForLogin() throws Exception {
        var attempt = new Attempt();
        var req = attempt.req;
        var resp = attempt.resp;
        var connection = mock(Connection.class);
        var statement = mock(PreparedStatement.class);
        String password = "V-VII-may-2024-6-29aaaaaaaaa😀";
        when(req.getParameter("username")).thenReturn("new-user");
        when(req.getParameter("password")).thenReturn(password);
        when(req.getContextPath()).thenReturn("/test");
        when(connection.prepareStatement(anyString())).thenReturn(statement);
        try (var db = mockStatic(DBUtil.class)) {
            db.when(DBUtil::getConnection).thenReturn(connection);
            new RegisterServlet().doPost(req, resp);
            assertFalse(attempt.attributes.containsKey(RegistrationChallenge.SESSION_KEY));
            // Replaying the same solved request cannot create another account.
            new RegisterServlet().doPost(req, resp);
            db.verify(DBUtil::getConnection, times(1));
        }
        var hash = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(statement).setString(eq(2), hash.capture());
        assertTrue(Passwords.isHash(hash.getValue()));
        assertTrue(Passwords.verify(password, hash.getValue()));
        verify(statement).executeUpdate();
        verify(resp).sendRedirect("/test/login.jsp");
        verify(attempt.dispatcher).forward(req,resp);
    }

    @Test void validOldPasswordCannotBypassMissingExpiredOrDifferentSessionChallenge() throws Exception {
        for(int mode=0;mode<4;mode++) {
            var attempt=new Attempt();
            if(mode==0) when(attempt.req.getSession(false)).thenReturn(null);
            if(mode==1) attempt.attributes.clear();
            if(mode==2) attempt.attributes.put(RegistrationChallenge.SESSION_KEY,new RegistrationChallenge.Challenge(
                    "a".repeat(32),SALT,solved().prefix(),System.currentTimeMillis()-1));
            if(mode==3) when(attempt.req.getParameter("challengeId")).thenReturn("b".repeat(32));
            try(var db=mockStatic(DBUtil.class)) {
                new RegisterServlet().doPost(attempt.req,attempt.resp);
                db.verifyNoInteractions();
            }
            verify(attempt.dispatcher).forward(attempt.req,attempt.resp);
            verify(attempt.resp,never()).sendRedirect(anyString());
        }
    }

    @Test void tamperedClientSaltPrefixAndDifficultyAreIgnored() throws Exception {
        var attempt=new Attempt();
        attempt.attributes.put(RegistrationChallenge.SESSION_KEY,new RegistrationChallenge.Challenge(
                "a".repeat(32),SALT,"000000000000",System.currentTimeMillis()+60000));
        when(attempt.req.getParameter("challengeSalt")).thenReturn(SALT);
        when(attempt.req.getParameter("challengePrefix")).thenReturn(solved().prefix());
        when(attempt.req.getParameter("difficulty")).thenReturn("0");
        try(var db=mockStatic(DBUtil.class)) {
            new RegisterServlet().doPost(attempt.req,attempt.resp);
            db.verifyNoInteractions();
        }
        verify(attempt.req).setAttribute("msg","密码尚未通过第 11 项随机哈希挑战。");
    }

    @Test void passingTheHashDoesNotSkipTheOriginalRules() throws Exception {
        var attempt=new Attempt();
        String weak="Password123!";
        when(attempt.req.getParameter("password")).thenReturn(weak);
        attempt.attributes.put(RegistrationChallenge.SESSION_KEY,new RegistrationChallenge.Challenge(
                "a".repeat(32),SALT,RegistrationChallenge.digest(SALT,weak).substring(0,12),System.currentTimeMillis()+60000));
        try(var db=mockStatic(DBUtil.class)) {
            new RegisterServlet().doPost(attempt.req,attempt.resp);
            db.verifyNoInteractions();
        }
        verify(attempt.dispatcher).forward(attempt.req,attempt.resp);
    }

    @Test void databaseFailureDoesNotConsumeASolvedChallenge() throws Exception {
        var attempt=new Attempt();
        var connection=mock(Connection.class); var statement=mock(PreparedStatement.class);
        var config=mock(ServletConfig.class); var context=mock(ServletContext.class);
        when(config.getServletContext()).thenReturn(context);
        when(connection.prepareStatement(anyString())).thenReturn(statement);
        when(statement.executeUpdate()).thenThrow(new SQLException("duplicate","23000",1062));
        var servlet=new RegisterServlet(); servlet.init(config);
        try(var db=mockStatic(DBUtil.class)) {
            db.when(DBUtil::getConnection).thenReturn(connection);
            servlet.doPost(attempt.req,attempt.resp);
        }
        assertNotNull(attempt.attributes.get(RegistrationChallenge.SESSION_KEY));
        verify(attempt.req).setAttribute("msg","账号已被注册");
        verify(attempt.resp,never()).sendRedirect(anyString());
    }
}
