<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="com.example.yytfsupportsite.yytf.util.RegistrationChallenge" %>
<%
    long challengeNow = System.currentTimeMillis();
    RegistrationChallenge.Challenge challenge = RegistrationChallenge.current(session, challengeNow);
%>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>注册账号</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/register.css?v=20261012-2">
</head>
<body>

<div class="container registration">
    <h2>注册</h2>
    <p class="registration-difficulty">如果注册遇到困难，请联系网站管理员。</p>
    <%-- 显示提示信息 --%>
    <p class="msg">
        <% String msg = (String) request.getAttribute("msg");
            if (msg != null) { %>
        <%= msg %>
        <% } %>
    </p>

    <form method="post" action="register" id="registrationForm"
          data-challenge-salt="<%= challenge.salt() %>" data-challenge-prefix="<%= challenge.prefix() %>"
          data-challenge-expires="<%= challenge.expiresAt() %>" data-server-now="<%= challengeNow %>">
        <input type="hidden" name="challengeId" value="<%= challenge.id() %>">
        <div class="registration-fields">
            <label for="registrationUsername">用户名</label>
            <input type="text" id="registrationUsername" name="username" placeholder="请输入用户名" autocomplete="username" maxlength="50" required>
            <label for="registrationPassword">密码</label>
            <input type="password" id="registrationPassword" name="password" placeholder="请输入密码" autocomplete="new-password" maxlength="1024" aria-describedby="passwordStats passwordNotes" required>
            <p id="passwordStats" class="password-help">实际长度：<strong id="passwordLength">0</strong> · 数字之和：<strong id="passwordDigitSum">0</strong></p>
            <div class="challenge-details">
                <p>本次随机串：<code id="challengeSalt"><%= challenge.salt() %></code></p>
                <p>目标前缀：<code id="challengeTarget"><%= challenge.prefix() %></code></p>
                <p>当前计算结果：<code id="challengeDigest">输入密码后显示</code></p>
                <p id="challengeTime">挑战有效期 30 分钟。</p>
                <p id="passwordNotes">按 UTF-8 计算 SHA-256（随机串 + 换行符 LF + 原始密码），结果的前 12 位须与目标完全一致。随机串本身不计入密码长度或数字之和。</p>
                <p>有效期内刷新不会换题；过期后刷新获取新题。满足全部 11 项即可注册。</p>
                <a href="register.jsp" id="challengeReload" hidden>挑战已过期，重新获取</a>
            </div>
            <p id="registrationStatus" class="submit-status" role="status" aria-live="polite">密码尚未满足全部 11 项要求。</p>
            <input type="submit" value="注册" id="registerButton" disabled>
            <noscript><p class="msg">请启用 JavaScript，以实时检查密码要求。</p></noscript>
        </div>
        <aside class="password-requirements" aria-labelledby="passwordRulesHeading">
            <h3 id="passwordRulesHeading">密码要求</h3>
            <ol>
                <li data-password-rule="1" data-valid="false"><span class="rule-symbol" aria-label="不符合">×</span><span>1. 长度至少为 5。</span></li>
                <li data-password-rule="2" data-valid="false"><span class="rule-symbol" aria-label="不符合">×</span><span>2. 至少包含一个数字 0～9。</span></li>
                <li data-password-rule="3" data-valid="false"><span class="rule-symbol" aria-label="不符合">×</span><span>3. 至少包含一个大写英文字母。</span></li>
                <li data-password-rule="4" data-valid="false"><span class="rule-symbol" aria-label="不符合">×</span><span>4. 至少包含一个特殊符号。</span></li>
                <li data-password-rule="5" data-valid="false"><span class="rule-symbol" aria-label="不符合">×</span><span>5. 所有数字字符的数值之和恰好为 25。</span></li>
                <li data-password-rule="6" data-valid="false"><span class="rule-symbol" aria-label="不符合">×</span><span>6. 包含至少一个小写英文月份名。</span></li>
                <li data-password-rule="7" data-valid="false"><span class="rule-symbol" aria-label="不符合">×</span><span>7. 恰好包含两个独立的罗马数字，且数值乘积为 35。</span></li>
                <li data-password-rule="8" data-valid="false"><span class="rule-symbol" aria-label="不符合">×</span><span>8. 包含至少一个四位闰年。</span></li>
                <li data-password-rule="9" data-valid="false"><span class="rule-symbol" aria-label="不符合">×</span><span>9. 密码中包含其实际长度。</span></li>
                <li data-password-rule="10" data-valid="false"><span class="rule-symbol" aria-label="不符合">×</span><span>10. 密码的实际长度是质数。</span></li>
                <li data-password-rule="11" data-valid="false"><span class="rule-symbol" aria-label="不符合">×</span><span>11. 通过本次随机哈希挑战，计算结果须以 <code><%= challenge.prefix() %></code> 开头，且挑战未过期。</span></li>
            </ol>
        </aside>
    </form>
    <a href="login.jsp">已有账号？去登录</a>
</div>
<script src="js/registration-password-rules.js?v=20261012-1" defer></script>
<script src="js/registration-challenge.js?v=20261012-1" defer></script>
<script src="js/register.js?v=20261012-2" defer></script>
</body>
</html>
