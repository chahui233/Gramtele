package com.example.yytfsupportsite.yytf.util;
import java.sql.*;
public final class DBUtil {
    private DBUtil() {}
    public static String setting(String key, String fallback) {
        String value = System.getProperty(key);
        if (value == null) value = System.getenv(key);
        return value == null || value.isBlank() ? fallback : value;
    }
    public static Connection getConnection() throws SQLException {
        String password = setting("DB_PASSWORD", null);
        if (password == null) throw new SQLException("DB_PASSWORD is not configured");
        loadDriver();
        return DriverManager.getConnection(setting("DB_URL",
                "jdbc:mysql://localhost:3306/yytf_support?serverTimezone=Asia/Shanghai&useUnicode=true&characterEncoding=UTF-8"),
                setting("DB_USER", "yytf_support"), password);
    }
    static void loadDriver() throws SQLException {
        // Tomcat can initialize DriverManager before WEB-INF/lib is visible.
        // Load through this application's class loader instead of relying on JDBC discovery.
        try {
            Class.forName("com.mysql.cj.jdbc.Driver", true, DBUtil.class.getClassLoader());
        } catch (ClassNotFoundException e) {
            throw new SQLException("MySQL JDBC driver missing from WEB-INF/lib", "08001", e);
        }
    }
}
