package ru.staffly.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
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
    private final PositionRepository positionRepository;
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

            userRepository.findByPhone("+79999999999")
                    .orElseGet(() -> userRepository.save(User.builder()
                            .phone("+79999999999")
                            .email("admin@staffly.local")
                            .firstName("Demo")
                            .lastName("Admin")
                            .passwordHash(passwordEncoder.encode("admin123"))
                            .active(true)
                            .build()));

            if (positionRepository.findByRestaurantIdAndActiveTrue(restaurant.getId()).stream()
                    .noneMatch(position -> position.getLevel() == RestaurantRole.ADMIN)) {
                positionRepository.save(Position.builder()
                        .restaurant(restaurant)
                        .name("Управляющий")
                        .level(RestaurantRole.ADMIN)
                        .active(true)
                        .build());
            }
            // The configured CREATOR has global access and is deliberately not an employee.
        };
    }
}
