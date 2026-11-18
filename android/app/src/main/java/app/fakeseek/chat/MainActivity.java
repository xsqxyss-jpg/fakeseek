package app.fakeseek.chat;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * 沉浸式布局 + 原生返回交给网页：
 * 1. 系统栏透明、不单独染色，页面背景自己延伸上去（这就是「不染色但不重合」）；
 * 2. 系统栏高度注入成 CSS 变量 --safe-top / --safe-bottom，各区域自行让开（聊天页顶栏吃满，侧栏从状态栏下方开始，自然一高一低）；
 * 3. 系统返回键与边缘滑动手势统一交给网页的 __fakeseekGoBack()，网页处理不了才退出应用。
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 全屏沉浸：内容可以画到系统栏下面
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        boolean night = (getResources().getConfiguration().uiMode
                & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
                == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(!night);
        controller.setAppearanceLightNavigationBars(!night);

        // 把系统栏与键盘高度注入网页：WebView 里 env(safe-area-inset-*) 恒为 0，必须由原生给。
        // --safe-bottom 只算导航条；键盘高度单独给 --ime-height，配合 adjustResize 让视口自己缩。
        final WebView webView = getBridge().getWebView();
        final View decor = getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(decor, (view, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            float density = getResources().getDisplayMetrics().density;
            // --safe-bottom 保持「底部导航条高度」不变（这是已经在真机上验证过的布局）。
            // 键盘高度单独作为 --ime-height 注入，由 viewport.ts 判断视口有没有真的缩小：
            // 缩小了说明键盘已被让开，不再补；没缩小（部分机型 WebView 不跟着缩）才补差额。
            final String js = String.format(
                    "document.documentElement.style.setProperty('--safe-top','%dpx');"
                            + "document.documentElement.style.setProperty('--safe-bottom','%dpx');"
                            + "document.documentElement.style.setProperty('--ime-height','%dpx');"
                            + "document.documentElement.style.setProperty('--nav-bottom','%dpx');",
                    Math.round(bars.top / density),
                    Math.round(bars.bottom / density),
                    Math.round(ime.bottom / density),
                    Math.round(bars.bottom / density));
            webView.post(() -> webView.evaluateJavascript(js, null));
            return insets;
        });

        // 系统返回键 / 边缘滑动返回：先问网页
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                webView.evaluateJavascript(
                        "(window.__fakeseekGoBack && window.__fakeseekGoBack()) ? '1' : '0'",
                        value -> {
                            if (!"\"1\"".equals(value)) {
                                setEnabled(false);
                                getOnBackPressedDispatcher().onBackPressed();
                                setEnabled(true);
                            }
                        });
            }
        });
    }
}
