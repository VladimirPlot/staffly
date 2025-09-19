package ru.staffly.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

@Configuration
public class WebStaticConfig implements WebMvcConfigurer {
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String dir = Paths.get("data/avatars").toAbsolutePath().toString() + "/";
        registry.addResourceHandler("/static/avatars/**")
                .addResourceLocations("file:" + dir);
    }
}