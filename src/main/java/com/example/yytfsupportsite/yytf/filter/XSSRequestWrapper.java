package com.example.yytfsupportsite.yytf.filter;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;

public class XSSRequestWrapper extends HttpServletRequestWrapper {

    public XSSRequestWrapper(HttpServletRequest request) {
        super(request);
    }

    @Override
    public String getParameter(String name) {
        return sanitize(super.getParameter(name));
    }

    @Override
    public String[] getParameterValues(String name) {
        String[] values = super.getParameterValues(name);
        if (values == null) return null;

        String[] sanitized = new String[values.length];
        for (int i = 0; i < values.length; i++) {
            sanitized[i] = sanitize(values[i]);
        }
        return sanitized;
    }

    private String sanitize(String value) {
        if (value == null) return null;

        // 拦截基础XSS关键词，如果检测到直接返回空字符串（可按需扩展）
        String lower = value.toLowerCase();
        if (lower.contains("<script") || lower.contains("onerror") || lower.contains("onload") || lower.contains("eval(") || lower.contains("javascript:")) {
            return "";
        }

        return value
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll("\"", "")
                .replaceAll("'", "")
                .replaceAll("&", "&amp;");
    }
}
