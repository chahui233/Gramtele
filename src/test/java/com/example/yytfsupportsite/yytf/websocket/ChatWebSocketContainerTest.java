package com.example.yytfsupportsite.yytf.websocket;

import jakarta.servlet.http.*;
import org.apache.catalina.startup.Tomcat;
import org.apache.tomcat.websocket.server.WsSci;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.nio.file.Path;
import java.util.Set;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

class ChatWebSocketContainerTest {
    @TempDir Path directory;

    @Test
    void actualTomcatHandshakeDeliversMessagesToTwoLoggedInTabs() throws Exception {
        Tomcat tomcat = new Tomcat();
        tomcat.setBaseDir(directory.toString());
        tomcat.setPort(0);
        tomcat.getConnector();
        var context = tomcat.addContext("/chat-test", directory.toString());
        context.setParentClassLoader(ChatWebSocket.class.getClassLoader());
        context.addServletContainerInitializer(new WsSci(), Set.of(ChatWebSocket.class));
        Tomcat.addServlet(context, "default", new org.apache.catalina.servlets.DefaultServlet());
        context.addServletMappingDecoded("/", "default");
        Tomcat.addServlet(context, "testLogin", new HttpServlet() {
            @Override protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
                req.getSession().setAttribute("userId", 7);
                resp.getWriter().write("ok");
            }
        });
        context.addServletMappingDecoded("/test-login", "testLogin");
        java.net.http.WebSocket first = null, second = null;
        try {
            tomcat.start();
            String address = "127.0.0.1:" + tomcat.getConnector().getLocalPort() + "/chat-test";
            HttpClient http = HttpClient.newHttpClient();
            var login = http.send(HttpRequest.newBuilder(URI.create("http://" + address + "/test-login")).build(),
                    HttpResponse.BodyHandlers.ofString());
            String cookie = login.headers().firstValue("set-cookie").orElseThrow().split(";")[0];
            Inbox firstInbox = new Inbox(), secondInbox = new Inbox();
            first = http.newWebSocketBuilder().header("Cookie", cookie)
                    .buildAsync(URI.create("ws://" + address + "/chatSocket/7"), firstInbox).get(10, TimeUnit.SECONDS);
            second = http.newWebSocketBuilder().header("Cookie", cookie)
                    .buildAsync(URI.create("ws://" + address + "/chatSocket/7"), secondInbox).get(10, TimeUnit.SECONDS);
            // Wait for endpoint registration by probing delivery; no database or external server involved.
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            while (secondInbox.messages.isEmpty() && System.nanoTime() < deadline) {
                ChatWebSocket.sendPrivateMessage(9, 7, "ready");
                if ("ready".equals(secondInbox.messages.poll(100, TimeUnit.MILLISECONDS))) break;
            }
            firstInbox.messages.clear();
            secondInbox.messages.clear();
            ChatWebSocket.sendPrivateMessage(9, 7, "live");
            assertEquals("live", firstInbox.messages.poll(5, TimeUnit.SECONDS));
            assertEquals("live", secondInbox.messages.poll(5, TimeUnit.SECONDS));
            first.sendClose(java.net.http.WebSocket.NORMAL_CLOSURE, "leaving").get(5, TimeUnit.SECONDS);
            assertTrue(firstInbox.closed.await(5, TimeUnit.SECONDS));
            ChatWebSocket.sendPrivateMessage(9, 7, "after-close");
            assertEquals("after-close", secondInbox.messages.poll(5, TimeUnit.SECONDS));

            Inbox anonymous = new Inbox();
            var unauthenticated = http.newWebSocketBuilder()
                    .buildAsync(URI.create("ws://" + address + "/chatSocket/7"), anonymous).get(10, TimeUnit.SECONDS);
            assertTrue(anonymous.closed.await(5, TimeUnit.SECONDS));
            assertEquals(1008, anonymous.closeCode);
            unauthenticated.abort();
        } finally {
            if (first != null) first.abort();
            if (second != null) second.abort();
            tomcat.stop();
            tomcat.destroy();
        }
    }

    private static class Inbox implements java.net.http.WebSocket.Listener {
        final BlockingQueue<String> messages = new LinkedBlockingQueue<>();
        final CountDownLatch closed = new CountDownLatch(1);
        int closeCode;
        private final StringBuilder text = new StringBuilder();
        @Override public void onOpen(java.net.http.WebSocket socket) { socket.request(1); }
        @Override public CompletionStage<?> onText(java.net.http.WebSocket socket, CharSequence data, boolean last) {
            text.append(data);
            if (last) { messages.add(text.toString()); text.setLength(0); }
            socket.request(1);
            return null;
        }
        @Override public CompletionStage<?> onClose(java.net.http.WebSocket socket, int status, String reason) {
            closeCode = status;
            closed.countDown();
            return null;
        }
    }
}
