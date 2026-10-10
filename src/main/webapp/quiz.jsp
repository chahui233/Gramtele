<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<html>
<head>
    <title>你暗恋作者吗？</title>
    <style>
        body {
            font-family: "微软雅黑", sans-serif;
            background: #f8f8f8;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }

        h2 {
            color: #e91e63;
            text-align: center;
            margin-bottom: 20px;
            font-size: 32px;
        }

        .quiz-container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 600px;
        }

        .question {
            margin-bottom: 20px;
        }

        .question label {
            font-size: 18px;
            color: #333;
        }

        .question input[type="radio"] {
            margin-right: 10px;
            transform: scale(1.2);
            cursor: pointer;
        }

        .submit-btn {
            padding: 12px 30px;
            background-color: #ff69b4;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            display: block;
            margin: 20px auto;
            font-size: 18px;
            transition: background-color 0.3s;
        }

        .submit-btn:hover {
            background-color: #f06292;
        }

        .result {
            text-align: center;
            font-weight: bold;
            margin-top: 20px;
            color: #4caf50;
            font-size: 22px;
        }

        .footer {
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 14px;
            color: #777;
            text-align: center;
            margin-top: 20px;
        }

        .footer p {
            margin: 5px 0;
        }

        .back-btn {
            position: fixed;
            top: 10px;
            left: 10px;
            padding: 8px 16px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            z-index: 999;
        }

        .back-btn:hover {
            background-color: #388e3c;
        }
    </style>
</head>
<body>
<button class="back-btn" onclick="history.back()">← 返回</button>

<div class="quiz-container">
    <h2>关于作者的知识小测试</h2>

    <form id="quizForm" onsubmit="return checkAnswers()">
        <div class="question">
            <label>1. 我最喜欢的V-Tuber是？</label><br>
            <input type="radio" name="q1" value="jiaran">嘉然<br>
            <input type="radio" name="q1" value="zi">阿梓<br>
            <input type="radio" name="q1" value="taffy">永雏塔菲<br>
        </div>
        <div class="question">
            <label>2. 我最喜欢的动物是？</label><br>
            <input type="radio" name="q2" value="cat">猫<br>
            <input type="radio" name="q2" value="deer">鹿<br>
            <input type="radio" name="q2" value="dog">狗<br>
        </div>
        <div class="question">
            <label>3. 我参加过哪个战役？</label><br>
            <input type="radio" name="q3" value="w">武汉会战<br>
            <input type="radio" name="q3" value="t">太原会战<br>
            <input type="radio" name="q3" value="x">徐州会战<br>
        </div>
        <input type="submit" value="提交答题" class="submit-btn">
    </form>

    <div id="result" class="result"></div>
</div>

<footer class="footer">
    <p>Copyright © 魅影网络科技有限公司<br>
        联系: lsgming1z@gmail.com<br>
        我们立足于中华人民共和国，受当地法律保护！</p>
</footer>

<script>
    function checkAnswers() {
        let score = 0;
        if (document.querySelector('input[name="q1"]:checked')?.value === "taffy") score++;
        if (document.querySelector('input[name="q2"]:checked')?.value === "deer") score++;
        if (document.querySelector('input[name="q3"]:checked')?.value === "w") score++;

        let message = "你得了 " + score + " / 3 分！";
        if (score === 3) message += "铁暗恋";
        else if (score === 2) message += "一般";
        else if (score === 1) message += "无语喵";
        else message += "南蚌";

        document.getElementById("result").innerText = message;

        return false; // 阻止表单跳转
    }
</script>
</body>
</html>
