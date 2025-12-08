# استيراد المكتبات اللازمة

# 1. NumPy: مكتبة للحسابات الرياضية
import numpy as np

# مثال على استخدام NumPy
a = np.array([1, 2, 3])
print(a)

# 2. Pandas: مكتبة قوية لمعالجة البيانات
import pandas as pd

# مثال على استخدام pandas
data = {'Name': ['Alice', 'Bob'], 'Age': [25, 30]}
df = pd.DataFrame(data)
print(df)

# 3. Matplotlib: مكتبة لرسم البيانات
import matplotlib.pyplot as plt

# مثال على استخدام matplotlib للرسم
plt.plot([1, 2, 3], [4, 5, 6])
plt.title('مثال رسم')
plt.xlabel('المحور السيني')
plt.ylabel('المحور الصادي')
plt.show()

# 4. Scikit-learn: مكتبة تعلم الآلة
from sklearn.linear_model import LinearRegression

# مثال على استخدام scikit-learn لإنشاء نموذج خطي
model = LinearRegression()
# ... استخدم النموذج هنا ...

# 5. Requests: مكتبة للتعامل مع الطلبات الشبكية
import requests


# مثال على استخدام requests لطلب بيانات من API
response = requests.get('https://api.example.com/data')
print(response.json())

# 6. Flask: إطار عمل لبناء تطبيقات الويب
from flask import Flask

app = Flask(__name__)

@app.route('/')
def home():
    return 'مرحباً بالعالم!'

# قم بتشغيل التطبيق مع تحديد مكان التشغيل، يمكنك التعليق عليه في حال رغبت في تشغيله لاحقاً
# app.run()

# 7. Django: إطار عمل لتطوير تطبيقات الويب الكبيرة والمعقدة
# لتشغيل مشروع Django، تحتاج إلى تنفيذ الأوامر من سطر الأوامر بدلاً من استيرادها هنا.