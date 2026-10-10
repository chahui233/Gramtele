package com.example.yytfsupportsite.yytf.filter;
import jakarta.servlet.*;
import jakarta.servlet.annotation.WebFilter;
import java.io.IOException;
// Escape at the output boundary; never rewrite credentials or message text.
@WebFilter("/*")
public class XSSFilter implements Filter {
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        request.setCharacterEncoding("UTF-8");
        response.setCharacterEncoding("UTF-8");
        chain.doFilter(request, response);
    }
}
