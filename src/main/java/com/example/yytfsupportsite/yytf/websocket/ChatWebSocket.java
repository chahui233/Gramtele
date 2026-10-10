package com.example.yytfsupportsite.yytf.websocket;

import com.google.gson.Gson;
import jakarta.servlet.http.HttpSession;
import jakarta.websocket.*;
import jakarta.websocket.server.*;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@ServerEndpoint(value = "/chatSocket/{userId}", configurator = ChatWebSocket.AuthConfigurator.class)
public class ChatWebSocket {
    // Track each connection independently: multiple tabs must not replace each other.
    private static final Map<Session, Client> clients = new ConcurrentHashMap<>();
    private record Client(int userId, HttpSession httpSession) {
        boolean authenticated() {
            try { return Integer.valueOf(userId).equals(httpSession.getAttribute("userId")); }
            catch (IllegalStateException e) { return false; }
        }
    }

    public static class AuthConfigurator extends ServerEndpointConfig.Configurator {
        @Override
        public void modifyHandshake(ServerEndpointConfig config, HandshakeRequest request,
                                    HandshakeResponse response) {
            config.getUserProperties().remove("httpSession");
            if (request.getHttpSession() instanceof HttpSession httpSession) {
                config.getUserProperties().put("httpSession", httpSession);
            }
        }
    }

    @OnOpen
    public void onOpen(Session session, @PathParam("userId") int userId) {
        Object httpSession = session.getUserProperties().get("httpSession");
        if (httpSession instanceof HttpSession authenticatedSession) {
            Client client = new Client(userId, authenticatedSession);
            if (client.authenticated()) {
                clients.put(session, client);
                return;
            }
        }
        close(session);
    }

    @OnClose
    public void onClose(Session session) {
        clients.remove(session);
    }

    @OnError
    public void onError(Session session, Throwable error) {
        if (session != null) {
            clients.remove(session);
            close(session);
        }
    }

    private static void close(Session session) {
        try { session.close(new CloseReason(CloseReason.CloseCodes.VIOLATED_POLICY, "Session unavailable")); }
        catch (IOException | IllegalStateException ignored) {}
    }

    private static void send(Session session, Client client, String json) {
        if (!client.authenticated()) {
            clients.remove(session);
            close(session);
            return;
        }
        // BasicRemote cannot send concurrent text frames on the same connection.
        synchronized (session) {
            try {
                if (session.isOpen()) session.getBasicRemote().sendText(json);
                else clients.remove(session);
            } catch (IOException | IllegalStateException e) {
                clients.remove(session);
                close(session);
            }
        }
    }

    public static void broadcastToAll(String json) {
        clients.forEach((session, client) -> send(session, client, json));
    }

    public static void sendPrivateMessage(int senderId, int receiverId, String json) {
        clients.forEach((session, client) -> {
            if (client.userId() == senderId || client.userId() == receiverId) send(session, client, json);
        });
    }

    public static void pushMessage(long id, int senderId, Integer receiverId, String senderName,
                                   String avatar, String content, String imageUrl, String time) {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("id", id);
        message.put("senderId", senderId);
        message.put("chatWith", receiverId == null ? -1 : receiverId);
        message.put("senderName", senderName);
        message.put("avatar", avatar);
        message.put("content", content);
        message.put("image", imageUrl);
        message.put("time", time);
        String json = new Gson().toJson(message);
        if (receiverId == null || receiverId == -1) broadcastToAll(json);
        else sendPrivateMessage(senderId, receiverId, json);
    }
}
