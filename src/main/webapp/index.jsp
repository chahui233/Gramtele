<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<html>
<head>
    <meta charset="UTF-8">
    <title>欢迎来到 GramTele</title>
    <link rel="icon" href="images/ico/logo.png" type="image/x-icon">

    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: "Segoe UI", sans-serif;
            background: linear-gradient(135deg, #f0f4f8, #d4e0ec);
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }

        .welcome-container {
            text-align: center;
            background: white;
            padding: 60px 40px;
            border-radius: 16px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
        }

        .logo-img {
            width: 60px;
            height: 60px;
            margin-bottom: 20px;
        }

        h1 {
            font-size: 32px;
            color: #333;
            margin-bottom: 10px;
        }

        p {
            font-size: 16px;
            color: #666;
            margin-bottom: 30px;
        }

        .enter-btn {
            padding: 12px 28px;
            font-size: 16px;
            background-color: #0088cc;
            color: white;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            transition: background-color 0.3s ease;
        }

        .enter-btn:hover {
            background-color: #0070a5;
        }
    </style>
</head>
<body>
<div class="welcome-container">
    <img src="images/ico/logo.png" alt="GramTele Logo" class="logo-img">
    <h1>欢迎来到 Gramtele</h1>
    <p>一个与世界连接的地方</p>
    <form action="login.jsp">
        <button type="submit" class="enter-btn">点击进入</button>
    </form>
</div>
</body>
</html>
