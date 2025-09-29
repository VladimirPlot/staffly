package ru.staffly.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

@Configuration
public class WebStaticConfig implements WebMvcConfigurer {
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String avatarsDir = Paths.get("data/avatars").toAbsolutePath().toString() + "/";
        registry.addResourceHandler("/static/avatars/**")
                .addResourceLocations("file:" + avatarsDir);

        // NEW: изображения для training items
        String trainingDir = Paths.get("data/training").toAbsolutePath().toString() + "/";
        registry.addResourceHandler("/static/training/**")
                .addResourceLocations("file:" + trainingDir);
    }
}