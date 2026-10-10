package com.example.yytfsupportsite.yytf.util;

import org.junit.jupiter.api.Test;
import java.net.URL;
import java.net.URLClassLoader;
import java.sql.DriverManager;
import java.sql.SQLException;
import static org.junit.jupiter.api.Assertions.*;

class DBUtilDriverTest {
    @Test
    void loadsDriverWhenDriverManagerWasInitializedBeforeWebApplication() throws Exception {
        // Simulate a container that has already completed JDBC service discovery.
        DriverManager.getDrivers();
        URL connector = Class.forName("com.mysql.cj.jdbc.Driver", false, getClass().getClassLoader())
                .getProtectionDomain().getCodeSource().getLocation();
        try (URLClassLoader webapp = new URLClassLoader(new URL[]{
                getClass().getProtectionDomain().getCodeSource().getLocation(),
                DBUtil.class.getProtectionDomain().getCodeSource().getLocation(), connector
        }, ClassLoader.getPlatformClassLoader())) {
            Class<?> probe = webapp.loadClass(Probe.class.getName());
            assertEquals(Boolean.FALSE, probe.getMethod("driverAvailable").invoke(null));
            probe.getMethod("load").invoke(null);
            assertEquals(Boolean.TRUE, probe.getMethod("driverAvailable").invoke(null));
            probe.getMethod("cleanup").invoke(null);
        }
    }

    public static class Probe {
        public static boolean driverAvailable() {
            try {
                DriverManager.getDriver("jdbc:mysql://127.0.0.1:3306/yytf_support");
                return true;
            } catch (SQLException e) {
                return false;
            }
        }
        public static void load() throws SQLException {
            DBUtil.loadDriver();
        }
        public static void cleanup() throws Exception {
            for (var driver : java.util.Collections.list(DriverManager.getDrivers())) {
                DriverManager.deregisterDriver(driver);
            }
            Class.forName("com.mysql.cj.jdbc.AbandonedConnectionCleanupThread")
                    .getMethod("checkedShutdown").invoke(null);
        }
    }
}
