package com.example.yytfsupportsite.yytf.filter;
import com.example.yytfsupportsite.yytf.util.DBUtil;
import jakarta.servlet.*;
import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.net.URI;
import java.sql.*;
import java.util.Set;

@WebFilter(urlPatterns = "/*", dispatcherTypes = {DispatcherType.REQUEST, DispatcherType.FORWARD})
public class SecurityFilter implements Filter {
    private static final Set<String> PUBLIC = Set.of("/", "/index.jsp", "/login", "/login.jsp",
            "/register", "/register.jsp", "/about.jsp", "/hello-servlet");
    private static final Set<String> ADMIN = Set.of("/admin.jsp", "/chatadmin.jsp", "/AdminUserServlet",
            "/AdminChatServlet", "/vadminServlet", "/deleteUser", "/deletePost", "/DeleteChatServlet",
            "/recover", "/EnableAdminServlet", "/DisableAdminServlet");
    public void doFilter(ServletRequest input, ServletResponse output, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) input;
        HttpServletResponse resp = (HttpServletResponse) output;
        req.setCharacterEncoding("UTF-8");
        resp.setCharacterEncoding("UTF-8");
        resp.setHeader("X-Content-Type-Options", "nosniff");
        resp.setHeader("X-Frame-Options", "DENY");
        resp.setHeader("Referrer-Policy", "same-origin");
        String path = req.getServletPath();
        if (path.startsWith("/css/") || path.startsWith("/js/") || path.startsWith("/images/")) {
            chain.doFilter(req, resp); return;
        }
        resp.setHeader("Cache-Control", "no-store");
        if (!Set.of("GET", "HEAD", "OPTIONS").contains(req.getMethod()) && !sameOrigin(req)) {
            resp.sendError(403, "Cross-origin request rejected"); return;
        }
        if (PUBLIC.contains(path)) { chain.doFilter(req, resp); return; }
        HttpSession session = req.getSession(false);
        Integer userId = session == null ? null : (Integer) session.getAttribute("userId");
        if (userId == null) {
            if (path.endsWith(".jsp")) resp.sendRedirect(req.getContextPath() + "/login.jsp");
            else resp.sendError(401);
            return;
        }
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement("SELECT is_admin, is_banned FROM users WHERE id=?")) {
            ps.setInt(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next() || rs.getBoolean("is_banned")) {
                    session.invalidate(); resp.sendError(403, "Account unavailable"); return;
                }
                boolean admin = rs.getBoolean("is_admin");
                session.setAttribute("isAdmin", admin);
                if (ADMIN.contains(path) && !admin) { resp.sendError(403); return; }
            }
        } catch (SQLException e) {
            req.getServletContext().log("Account authorization failed", e);
            resp.sendError(503, "Database unavailable; check configuration and migrations"); return;
        }
        chain.doFilter(req, resp);
    }
    static boolean sameOrigin(HttpServletRequest req) {
        String source = req.getHeader("Origin");
        if (source == null) source = req.getHeader("Referer");
        // Older browsers and privacy extensions may omit both headers.
        if (source == null) return true;
        try {
            URI uri = URI.create(source);
            int port = uri.getPort() == -1 ? ("https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80) : uri.getPort();
            return req.getScheme().equalsIgnoreCase(uri.getScheme())
                    && req.getServerName().equalsIgnoreCase(uri.getHost()) && req.getServerPort() == port;
        } catch (IllegalArgumentException e) { return false; }
    }
}
