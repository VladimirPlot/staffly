package ru.staffly.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;
import java.util.concurrent.TimeUnit;

@Configuration
public class WebStaticConfig implements WebMvcConfigurer {
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String avatarsDir = Paths.get("data/avatars").toAbsolutePath().toUri().toString();
        registry.addResourceHandler("/static/avatars/**")
                .addResourceLocations(avatarsDir)  // без ручного "file:" и "/" — уже в toUri()
                .setCacheControl(CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic());

        String trainingDir = Paths.get("data/training").toAbsolutePath().toUri().toString();
        registry.addResourceHandler("/static/training/**")
                .addResourceLocations(trainingDir)
                .setCacheControl(CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic());
    }
}