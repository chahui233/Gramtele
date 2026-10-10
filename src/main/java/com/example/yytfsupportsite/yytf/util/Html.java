package com.example.yytfsupportsite.yytf.util;
public final class Html {
    private Html() {}
    public static String escape(String value) {
        return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }
}
