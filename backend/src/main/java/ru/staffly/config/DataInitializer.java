package ru.staffly.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

@Configuration
@RequiredArgsConstructor
@Profile("dev & !worker") // ✅ только dev-сервер, не воркер, не прод
public class DataInitializer {

    private final UserRepository userRepository;
    private final RestaurantRepository restaurantRepository;
    private final RestaurantMemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;

    @Bean
    CommandLineRunner initData() {
        return args -> {
            Restaurant restaurant = restaurantRepository.findByCode("staffly-demo")
                    .orElseGet(() -> restaurantRepository.save(Restaurant.builder()
                            .name("Staffly Demo Restaurant")
                            .code("staffly-demo")
                            .active(true)
                            .build()));

            User admin = userRepository.findByPhone("+79999999999")
                    .orElseGet(() -> userRepository.save(User.builder()
                            .phone("+79999999999")
                            .email("admin@staffly.local")
                            .firstName("Demo")
                            .lastName("Admin")
                            .passwordHash(passwordEncoder.encode("admin123"))
                            .active(true)
                            .build()));

            memberRepository.findByUserIdAndRestaurantId(admin.getId(), restaurant.getId())
                    .orElseGet(() -> memberRepository.save(RestaurantMember.builder()
                            .user(admin)
                            .restaurant(restaurant)
                            .role(RestaurantRole.ADMIN)
                            .build()));
        };
    }
}