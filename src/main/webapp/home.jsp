<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="java.sql.*,com.example.yytfsupportsite.yytf.util.DBUtil"%>
<%@ page import="java.util.Map" %>
<%@ page import="java.util.List" %>
<%!
    public String escapeHtml(String input) {
        if (input == null) return "";
        return input.replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll("\"", "&quot;")
                .replaceAll("'", "&#x27;");
    }
%>

<%
    String birthday = "1867年8月12日";
    request.setAttribute("birthday",birthday);

%>
<%
    String username = (String) session.getAttribute("username");
    if (username == null) {
        response.sendRedirect("login.jsp");  // 如果没有登录，重定向到登录页面
        return;
    }

    Integer userId = (Integer) session.getAttribute("userId");  // 获取用户ID
    if (userId == null) {
        response.sendRedirect("login.jsp");  // 如果 userId 为 null，重定向到登录页面
        return;
    }
%>
<html>
<head>
    <meta charset="UTF-8">
    <title>GramTele</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<script>
    function pad(n) {
        return n < 10 ? '0' + n : n;
    }

    function updateCountdown() {
        const now = new Date();
        const year = (now.getMonth() > 7 || (now.getMonth() === 7 && now.getDate() >= 12))
            ? now.getFullYear() + 1 : now.getFullYear();
        const target = new Date(year + "-08-12T00:00:00");
        const diff = target - now;

        if (diff <= 0) {
            document.getElementById("countdown").innerHTML = "🎉 生日快乐，塔菲喵！";
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);

        let html = "距离聊天记录清空还有 <strong>" + pad(days) + "</strong> 天 ";
        html += "<strong>" + pad(hours) + "</strong> 小时 ";
        html += "<strong>" + pad(minutes) + "</strong> 分 ";
        html += "<strong>" + pad(seconds) + "</strong> 秒！";

        document.getElementById("countdown").innerHTML = html;
    }

    setInterval(updateCountdown, 1000);
    updateCountdown();
</script>

<script>
    let eggBuffer = "";

    document.addEventListener("keydown", function(e) {
        // 拼接输入字符，支持 Shift（大小写）
        eggBuffer += e.key;
        if (eggBuffer.length > 20) {
            eggBuffer = eggBuffer.slice(-20); // 控制长度
        }

        if (eggBuffer.includes("adc")) {
            showEasterEgg();
            eggBuffer = "";  // 重置防止多次触发
        }
    });

    function showEasterEgg() {
        // 弹出彩蛋内容
        const egg = document.createElement("div");
        egg.innerHTML = `
            <div style="
                position: fixed;
                top: 20%;
                left: 50%;
                transform: translate(-50%, -20%);
                background-color: #fff0f5;
                padding: 30px;
                border: 2px dashed #fb0404;
                border-radius: 12px;
                text-align: center;
                z-index: 9999;
                font-size: 20px;
                font-weight: bold;
                box-shadow: 0 0 20px rgba(244,2,2,0.5);
                animation: fadeIn 0.5s ease;
            ">
                哇！<br>我们ADC这波真的很霸气耶
            </div>
        `;
        document.body.appendChild(egg);

        // 自动移除
        setTimeout(() => egg.remove(), 5000);
    }
</script>

<style>
    @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
    }
</style>


<body>

<div id="adminConsole" style="display:none; position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#fff; border:2px solid #999; border-radius:10px; padding:20px; z-index:9999; box-shadow:0 0 15px rgba(0,0,0,0.3);">
    <h3 style="margin-bottom:10px; text-align:center;">管理员控制台</h3>
    <input id="consoleInput" type="text" placeholder="输入命令..." style="padding:8px 10px; width:300px; border-radius:5px; border:1px solid #ccc;">
</div>
<!-- 退出登录按钮 -->
<div style="position: fixed; top: 10px; left: 10px; z-index: 999;">
    <form action="logout" method="get">
        <button type="submit" style="padding: 6px 12px; font-size: 14px; border-radius: 5px; border: none; background-color: #f44336; color: white; cursor: pointer;">
            退出登录
        </button>
    </form>
</div>
<div style="position: absolute; top: 20px; right: 30px;">
    <form action="profile.jsp" method="get">
        <style>
            .action-button {
                padding: 6px 12px;
                border-radius: 20px;
                border: none;
                background-color: #0088cc;
                color: white;
                font-weight: bold;
                margin: 8px 6px;
                cursor: pointer;
                transition: background-color 0.3s;
            }

            .action-button:hover {
                background-color: #005f99;
            }
        </style>

        <div style="text-align:center;">
            <!-- 个人中心 -->
            <input type="submit" value="个人中心" class="action-button">


            <!-- 显示图片 -->
            <input type="button" value="打赏" class="action-button" onclick="showImagePopup()">

            <!-- 跳转链接 -->
            <input type="button" value="去异世界" class="action-button" onclick="goToWebsite()">
        </div>

    </form>
</div>

    <div class="container">
    <h2>🎉 欢迎，<%= escapeHtml(username) %>！</h2>
    <p style="text-align:center; color:#888;">你已成功登入Gramtele 🧁</p>
    <div id="countdown" style="text-align: center; font-size: 18px; margin: 20px auto; padding: 10px; background-color: #fff8f8; border-radius: 8px; border: 1px solid #ffd6e0;">
        正在加载倒计时...
    </div>

    <!--
    <div style="text-align: center; margin-bottom: 20px;">
        <a href="about.jsp" class="btn-about">关于...</a>
    </div> -->

    <div style="text-align: center; margin-bottom: 10px;">
        <a href="chat.jsp" class="btn-about">进入聊天室</a>
    </div>


    <!-- 留言发布表单 -->

    <form method="post" action="postMessage">
        <textarea name="content" rows="4" placeholder="说点什么..."></textarea>
        <input type="submit" value="发布">
    </form>


    <!-- 留言展示区域 -->
    <%
        List<Map<String, String>> posts = (List<Map<String, String>>) request.getAttribute("posts");
        int currentPage = request.getAttribute("currentPage") != null ? (int) request.getAttribute("currentPage") : 1;
        int totalPages = request.getAttribute("totalPages") != null ? (int) request.getAttribute("totalPages") : 1;

        if (posts == null) {
            response.sendRedirect("GetPostsServlet?page=1");
            return;
        }
    %>
    <div class="message-board">
        <h3>💬 留言板</h3>
        <ul class="message-list">
            <%
                for (Map<String, String> post : posts) {
                    String posterId = post.get("userId");
                    String posterName = post.get("username");
                    String content = post.get("content");
                    String time = post.get("createdAt");
            %>
            <li class="message-item">
                <div class="username" onclick="showUserOptions(<%= posterId %>, event)"><%= escapeHtml(posterName) %></div>
                <div class="message-content"><%= escapeHtml(content) %></div>
                <div class="message-time"><%= time %></div>
            </li>
            <%
                }
            %>
        </ul>

        <div class="pagination" style="margin-top: 20px; text-align: center;">
            <%
                // 上一页按钮
                if (currentPage > 1) {
            %>
            <a href="GetPostsServlet?page=<%= currentPage - 1 %>" style="display:inline-block; margin: 0 8px;">« 上一页</a>
            <%
                }

                // 中间页码
                for (int i = 1; i <= totalPages; i++) {
                    if (i == currentPage) {
            %>
            <span style="display:inline-block; margin: 0 5px; font-weight: bold; color: #0070a5;"><%= i %></span>
            <%
            } else {
            %>
            <a href="GetPostsServlet?page=<%= i %>" style="display:inline-block; margin: 0 5px;"><%= i %></a>
            <%
                    }
                }

                // 下一页按钮
                if (currentPage < totalPages) {
            %>
            <a href="GetPostsServlet?page=<%= currentPage + 1 %>" style="display:inline-block; margin: 0 8px;">下一页 »</a>
            <%
                }
            %>
        </div>


        <div id="user-options-popup" style="display:none; position:absolute; background:#fff; border:1px solid #ccc; padding:10px; border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,0.2); z-index:1000;">
            <button onclick="reportUser()">举报</button>
            <button onclick="addFriend(selectedUserId)">添加好友</button>
        </div>

        <script>
            let selectedUserId = null;
            function showUserOptions(userId, event) {
                selectedUserId = userId;
                const popup = document.getElementById("user-options-popup");
                popup.style.display = "block";
                const rect = event.target.getBoundingClientRect();
                popup.style.left = (rect.right + 10) + "px";
                popup.style.top = (rect.top + window.scrollY) + "px";
            }

            function addFriend(friendId) {
                if (!friendId || isNaN(friendId)) {
                    alert("❌ 无效的用户ID，无法添加好友！");
                    return;
                }

                fetch('AddFriendServlet', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: 'friendId=' + encodeURIComponent(friendId)
                })
                    .then(response => response.text())
                    .then(text => {
                        text = text.trim();
                        if (text === 'success') {
                            alert("✅ 添加好友成功！");
                        } else if (text === 'already') {
                            alert("⚠️ 你们已经是好友了！");
                        } else {
                            alert("❌ 添加失败！无法添加自己为好友！");
                        }
                    })
                    .catch(error => {
                        alert("⚠️ 请求失败！");
                    });
            }
        </script>
    </div>

    <script>

        function reportUser() {
            alert("已收到举报，我们将尽快处理！");
            document.getElementById("user-options-popup").style.display = "none";
        }

        // 点击外部关闭弹窗
        document.addEventListener("click", function(e) {
            const popup = document.getElementById("user-options-popup");
            if (!popup.contains(e.target) && !e.target.classList.contains("username")) {
                popup.style.display = "none";
            }
        });
    </script>


    <div style="text-align: center; margin: 30px 0;">
        <a href="quiz.jsp" class="btn-about">知识问答</a>
    </div>





</div>



<!-- 图片弹出框 -->
<div id="imagePopup" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
    background:#fff; padding:20px; border-radius:10px; box-shadow:0 0 10px rgba(0,0,0,0.3); z-index:10000;">
    <img src="images/IMG_4120.JPG" alt="示例图片" style="max-width:100%; max-height:80vh;">
    <div style="text-align:center; margin-top:10px;">
        <button onclick="closeImagePopup()" style="padding: 6px 12px; border-radius: 20px; border: none; background-color: #666; color: white; font-weight: bold;">关闭</button>
    </div>
</div>

<script>
    function showImagePopup() {
        document.getElementById("imagePopup").style.display = "block";
    }
    function closeImagePopup() {
        document.getElementById("imagePopup").style.display = "none";
    }
    function goToWebsite() {
        window.location.href = "https://vdse.bdstatic.com/192d9a98d782d9c74c96f09db9378d93.mp4";

    }
</script>




<script>
    let consoleActive = false;
    document.addEventListener("keydown", function(e) {
        if (!consoleActive) {
            window._keySequence = (window._keySequence || "") + e.key.toLowerCase();
            if (window._keySequence.includes("console")) {

                document.getElementById("adminConsole").style.display = "block";
                setTimeout(() => {
                    document.getElementById("consoleInput").focus();
                }, 1000);

                consoleActive = true;
                window._keySequence = "";
            }
        } else if (e.key === "Escape") {
            document.getElementById("adminConsole").style.display = "none";
            consoleActive = false;
        }
    });

    document.addEventListener("click", function(e) {
        const popup = document.getElementById("adminConsole");
        if (consoleActive && !popup.contains(e.target)) {
            popup.style.display = "none";
            consoleActive = false;
        }
    });

    document.getElementById("consoleInput").addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
            const val = this.value.trim().toLowerCase();
            if (val === "wedding") {
                window.location.href = "sihuo.jsp";
            } else if (val.startsWith("admin -")) {
                const key = val.split("-")[1].trim();
                if (key === "040623") {
                    window.location.href = "admin.jsp";
                } else {
                    alert("密钥无效");
                }
            } else {
                alert("未知命令");
            }
            this.value = "";
            document.getElementById("adminConsole").style.display = "none";
            consoleActive = false;
        }
    });
</script>

</body>
</html>
