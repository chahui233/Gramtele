package com.example.yytfsupportsite.yytf.websocket;

import jakarta.servlet.http.HttpSession;
import jakarta.websocket.*;
import jakarta.websocket.server.*;
import org.junit.jupiter.api.*;
import java.io.IOException;
import java.util.*;
import com.google.gson.JsonParser;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChatWebSocketTest {
    private final List<Session> sessions = new ArrayList<>();
    private Session connect(int userId) throws Exception {
        Session session = mock(Session.class);
        HttpSession http = mock(HttpSession.class);
        when(http.getAttribute("userId")).thenReturn(userId);
        when(session.getUserProperties()).thenReturn(new HashMap<>(Map.of("httpSession", http)));
        when(session.isOpen()).thenReturn(true);
        when(session.getBasicRemote()).thenReturn(mock(RemoteEndpoint.Basic.class));
        sessions.add(session);
        new ChatWebSocket().onOpen(session, userId);
        return session;
    }
    @AfterEach
    void cleanup() {
        sessions.forEach(s -> new ChatWebSocket().onClose(s));
    }
    @Test
    void everyTabReceivesAndOldCloseCannotRemoveNewConnection() throws Exception {
        Session old = connect(1), fresh = connect(1), other = connect(2);
        ChatWebSocket.broadcastToAll("first");
        for (Session s : sessions) verify(s.getBasicRemote()).sendText("first");
        new ChatWebSocket().onClose(old);
        ChatWebSocket.broadcastToAll("second");
        verify(old.getBasicRemote(), never()).sendText("second");
        verify(fresh.getBasicRemote()).sendText("second");
        verify(other.getBasicRemote()).sendText("second");
        verify(fresh, never()).close(any(CloseReason.class));
    }
    @Test
    void privateMessagesReachOnlySenderAndReceiverTabs() throws Exception {
        Session sender = connect(1), receiver = connect(2), receiverTab = connect(2), unrelated = connect(3);
        ChatWebSocket.sendPrivateMessage(1, 2, "private");
        for (Session s : List.of(sender, receiver, receiverTab)) verify(s.getBasicRemote()).sendText("private");
        verify(unrelated.getBasicRemote(), never()).sendText(anyString());
    }
    @Test
    void brokenConnectionDoesNotPreventOtherDeliveries() throws Exception {
        Session broken = connect(1), healthy = connect(2);
        RemoteEndpoint.Basic remote = broken.getBasicRemote();
        doThrow(new IOException("closed")).when(remote).sendText(anyString());
        assertDoesNotThrow(() -> ChatWebSocket.broadcastToAll("hello"));
        verify(healthy.getBasicRemote()).sendText("hello");
    }
    @Test
    void rejectsImpersonationAndExpiredSessions() throws Exception {
        Session session = connect(1);
        new ChatWebSocket().onClose(session);
        new ChatWebSocket().onOpen(session, 2);
        verify(session).close(any(CloseReason.class));
        ChatWebSocket.broadcastToAll("secret");
        verify(session.getBasicRemote(), never()).sendText(anyString());

        Session expired = connect(3);
        HttpSession http = (HttpSession) expired.getUserProperties().get("httpSession");
        when(http.getAttribute("userId")).thenThrow(new IllegalStateException("invalidated"));
        ChatWebSocket.broadcastToAll("secret");
        verify(expired.getBasicRemote(), never()).sendText(anyString());
    }
    @Test
    void handshakeWithoutLoginCannotReusePreviousAuthentication() {
        ServerEndpointConfig config = mock(ServerEndpointConfig.class);
        when(config.getUserProperties()).thenReturn(new HashMap<>());
        HttpSession http = mock(HttpSession.class);
        HandshakeRequest request = mock(HandshakeRequest.class);
        when(request.getHttpSession()).thenReturn(http);
        ChatWebSocket.AuthConfigurator auth = new ChatWebSocket.AuthConfigurator();
        auth.modifyHandshake(config, request, mock(HandshakeResponse.class));
        assertSame(http, config.getUserProperties().get("httpSession"));
        when(request.getHttpSession()).thenReturn(null);
        auth.modifyHandshake(config, request, mock(HandshakeResponse.class));
        assertFalse(config.getUserProperties().containsKey("httpSession"));
    }
    @Test
    void pushIncludesDatabaseIdAndRoundTripsSpecialCharacters() throws Exception {
        Session receiver = connect(2);
        String content = "引号\"、反斜杠\\、换行\n";
        ChatWebSocket.pushMessage(123, 1, 2, "发送人", "", content, "", "now");
        var captor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(receiver.getBasicRemote()).sendText(captor.capture());
        var json = JsonParser.parseString(captor.getValue()).getAsJsonObject();
        assertEquals(123, json.get("id").getAsLong());
        assertEquals(content, json.get("content").getAsString());
    }
}
