package ru.staffly.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // т.к. это API, форму логина и httpBasic убираем
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                // CSRF для простоты отключаем (для статeless API с JWT он не нужен)
                .csrf(AbstractHttpConfigurer::disable)
                // правила доступа
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/**").permitAll()   // наш ping и будущие открытые эндпоинты
                        .anyRequest().permitAll()                 // временно открываем всё, чтобы не мешало на MVP
                );

        return http.build();
    }
}