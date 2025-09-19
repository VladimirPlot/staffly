package ru.staffly.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.RestaurantRole;

@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final UserRepository userRepository;
    private final RestaurantRepository restaurantRepository;
    private final RestaurantMemberRepository memberRepository; // ← ДОБАВИЛИ
    private final PasswordEncoder passwordEncoder;

    @Bean
    CommandLineRunner initData() {
        return args -> {
            // 1. Ресторан staffly-demo
            Restaurant restaurant = restaurantRepository.findByCode("staffly-demo")
                    .orElseGet(() -> restaurantRepository.save(Restaurant.builder()
                            .name("Staffly Demo Restaurant")
                            .code("staffly-demo")
                            .active(true)
                            .build()));

            // 2. Пользователь-«создатель» (наш глобальный админ)
            User admin = userRepository.findByPhone("+79999999999")
                    .orElseGet(() -> userRepository.save(User.builder()
                            .phone("+79999999999")
                            .email("admin@staffly.local")
                            .firstName("Demo")
                            .lastName("Admin")
                            .passwordHash(passwordEncoder.encode("admin123"))
                            .active(true)
                            .build()));

            // 3. Обеспечим членство в ресторане с ролью ADMIN
            memberRepository.findByUserIdAndRestaurantId(admin.getId(), restaurant.getId())
                    .orElseGet(() -> memberRepository.save(RestaurantMember.builder()
                            .user(admin)
                            .restaurant(restaurant)
                            .role(RestaurantRole.ADMIN)
                            .build()));
        };
    }
}